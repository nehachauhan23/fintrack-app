import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { db } from "@/server/db";
import { AppError } from "@/lib/errors";
import type { AuthUser } from "@/server/auth/session";
import { OVERALL_BUDGET, categoryName } from "@/domain/categories";
import { suggestLimit } from "@/domain/budget";
import { addMonths, lastPeriods, periodKeyOf } from "@/domain/periods";
import { formatMoney } from "@/lib/format";
import { monthlyCategorySpend } from "@/server/services/analytics";
import { assertAiAllowed, generateObject } from "./generate";
import { SYSTEM_BASE } from "./prompts";

export interface BudgetSuggestion {
  category: string;
  name: string;
  suggested: number;
  average: number;
  months: number;
  current: number | null;
  reason: string;
}

const reasonsSchema = z.object({ items: z.array(z.object({ category: z.string(), reason: z.string().max(140) })).max(12) });

/**
 * The amounts are computed here from the user's own history (mean of recent months + a 10% buffer).
 * The model is only asked to explain them in a sentence, so it cannot move a number.
 */
export async function suggestBudgets(user: AuthUser, opts: { useAi: boolean }, now = new Date()): Promise<{ items: BudgetSuggestion[]; source: "ai" | "rules"; aiError?: string }> {
  const period = periodKeyOf(now);
  const periods = lastPeriods(3, addMonths(period, -1));
  const [spend, budgets] = await Promise.all([monthlyCategorySpend(user.id, periods), db.budget.findMany({ where: { userId: user.id } })]);
  const current = new Map(budgets.map((b) => [b.category, b.amount.toNumber()]));
  const money = (n: number) => formatMoney(n, user.currency, { hideCents: true });

  const totals = periods.map((_, i) => Object.values(spend).reduce((a, series) => a + (series[i] ?? 0), 0));
  const rows: BudgetSuggestion[] = [];
  const add = (category: string, series: number[]) => {
    const active = series.filter((v) => v > 0);
    if (active.length < 2) return;
    const limit = suggestLimit(series);
    if (!limit) return;
    const average = active.reduce((a, b) => a + b, 0) / active.length;
    rows.push({ category, name: categoryName(category), suggested: limit, average, months: active.length, current: current.get(category) ?? null, reason: `Averaged ${money(average)} over the last ${active.length} months, plus a 10% buffer.` });
  };
  add(OVERALL_BUDGET, totals);
  const byCategory = Object.entries(spend).sort((a, b) => b[1].reduce((x, y) => x + y, 0) - a[1].reduce((x, y) => x + y, 0)).slice(0, 8);
  for (const [category, series] of byCategory) add(category, series);
  if (rows.length === 0 || !opts.useAi) return { items: rows, source: "rules" };

  const digest = rows.map((r) => ({ category: r.category, average: Math.round(r.average), suggested: r.suggested, months: r.months }));
  const dataHash = createHash("sha256").update(JSON.stringify(digest)).digest("hex").slice(0, 16);
  const key = { userId_kind_periodKey: { userId: user.id, kind: "BUDGET_SUGGESTIONS" as const, periodKey: period } };
  const cached = await db.aiInsight.findUnique({ where: key });
  let reasons: Map<string, string> | null = null;
  if (cached?.dataHash === dataHash) {
    const parsed = reasonsSchema.safeParse(cached.payload);
    if (parsed.success) reasons = new Map(parsed.data.items.map((i) => [i.category, i.reason]));
  }

  let aiError: string | undefined;
  if (!reasons) {
    try {
      assertAiAllowed(user);
      const { data, model } = await generateObject({
        feature: "budget-suggest",
        userId: user.id,
        maxTokens: 700,
        schema: reasonsSchema,
        messages: [
          { role: "system", content: SYSTEM_BASE },
          {
            role: "user",
            content:
              `For each suggested monthly budget, write one friendly sentence (max 18 words) explaining the figure from the history. Do not change or restate different numbers. ` +
              `Return JSON: {"items":[{"category": string, "reason": string}]}.\n<data>${JSON.stringify(digest)}</data>`,
          },
        ],
      });
      await db.aiInsight.upsert({ where: key, create: { userId: user.id, kind: "BUDGET_SUGGESTIONS", periodKey: period, dataHash, payload: data, model }, update: { dataHash, payload: data, model } });
      reasons = new Map(data.items.map((i) => [i.category, i.reason]));
    } catch (err) {
      if (!(err instanceof AppError)) throw err;
      aiError = err.message;
    }
  }
  if (!reasons) return { items: rows, source: "rules", aiError };
  const known = reasons;
  return { items: rows.map((r) => ({ ...r, reason: known.get(r.category) || r.reason })), source: "ai" };
}
