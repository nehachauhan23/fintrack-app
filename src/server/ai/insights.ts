import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { db } from "@/server/db";
import { AppError } from "@/lib/errors";
import type { AuthUser } from "@/server/auth/session";
import { periodStats } from "@/server/services/analytics";
import type { PeriodKey } from "@/domain/periods";
import { assertAiAllowed, generateObject } from "./generate";
import { aiConfigured } from "./openrouter";
import { ruleBasedInsights, type InsightPayload } from "./insights-rules";
import { SYSTEM_BASE } from "./prompts";

export const insightSchema = z.object({
  headline: z.string().min(1).max(180),
  insights: z.array(z.object({ title: z.string().min(1).max(90), detail: z.string().min(1).max(300), tone: z.enum(["good", "watch", "neutral"]) })).min(1).max(5),
  tips: z.array(z.string().min(1).max(220)).max(3).default([]),
});

export type InsightResult = InsightPayload & {
  period: PeriodKey;
  source: "ai" | "rules";
  model: string | null;
  generatedAt: string | null;
  /** The numbers changed since the cached AI text was written. */
  stale: boolean;
  aiAvailable: boolean;
  aiError?: string;
};

const hashOf = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex").slice(0, 16);

/**
 * AI is only called when the user asks (`refresh`), never on page load, so browsing can't burn the request allowance.
 * Without a cached AI summary, deterministic insights are shown instead.
 */
export async function getMonthlyInsight(user: AuthUser, period: PeriodKey, opts: { refresh?: boolean } = {}): Promise<InsightResult> {
  const stats = await periodStats(user.id, period);
  const dataHash = hashOf(stats);
  const aiAvailable = user.aiEnabled && aiConfigured();
  const empty = stats.income === 0 && stats.expense === 0;
  const rules = (extra: { aiError?: string } = {}): InsightResult => ({ ...ruleBasedInsights(stats, user.currency), period, source: "rules", model: null, generatedAt: null, stale: false, aiAvailable, ...extra });

  const cached = await db.aiInsight.findUnique({ where: { userId_kind_periodKey: { userId: user.id, kind: "MONTHLY_SUMMARY", periodKey: period } } });
  const cachedPayload = cached ? insightSchema.safeParse(cached.payload) : null;

  if (!opts.refresh || empty) {
    if (cached && cachedPayload?.success && !empty) {
      return { ...cachedPayload.data, period, source: "ai", model: cached.model, generatedAt: cached.updatedAt.toISOString(), stale: cached.dataHash !== dataHash, aiAvailable };
    }
    return rules();
  }

  try {
    assertAiAllowed(user);
    const { data, model } = await generateObject({
      feature: "insights",
      userId: user.id,
      maxTokens: 900,
      schema: insightSchema,
      messages: [
        { role: "system", content: SYSTEM_BASE },
        {
          role: "user",
          content:
            `You are a calm, precise personal-finance analyst. Write a short monthly review from these aggregate figures (currency ${user.currency}). ` +
            `Use only numbers that appear in the data, never invent figures, and give no investment advice. ` +
            `Return JSON: {"headline": string, "insights": [{"title": string, "detail": string, "tone": "good"|"watch"|"neutral"}] (3-5 items), "tips": string[] (at most 3, practical and specific)}.\n` +
            `<data>${JSON.stringify(stats)}</data>`,
        },
      ],
    });
    const saved = await db.aiInsight.upsert({
      where: { userId_kind_periodKey: { userId: user.id, kind: "MONTHLY_SUMMARY", periodKey: period } },
      create: { userId: user.id, kind: "MONTHLY_SUMMARY", periodKey: period, dataHash, payload: data, model },
      update: { dataHash, payload: data, model },
    });
    return { ...data, period, source: "ai", model, generatedAt: saved.updatedAt.toISOString(), stale: false, aiAvailable };
  } catch (err) {
    if (!(err instanceof AppError)) throw err;
    // Keep showing the last good AI summary (flagged if the numbers have moved on) rather than downgrading it.
    if (cached && cachedPayload?.success) {
      return { ...cachedPayload.data, period, source: "ai", model: cached.model, generatedAt: cached.updatedAt.toISOString(), stale: cached.dataHash !== dataHash, aiAvailable, aiError: err.message };
    }
    return rules({ aiError: err.message });
  }
}
