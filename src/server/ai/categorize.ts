import "server-only";
import { z } from "zod";
import { db } from "@/server/db";
import { AppError } from "@/lib/errors";
import type { AuthUser } from "@/server/auth/session";
import { isCategoryFor } from "@/domain/categories";
import { normalizeMerchant } from "@/domain/merchant";
import { learnRule, loadRulesFor, resolveLocally } from "@/server/services/merchant-rules";
import { recategorize } from "@/server/services/transactions";
import { assertAiAllowed, generateObject } from "./generate";
import { SYSTEM_BASE, categoryCatalog } from "./prompts";
import { fence } from "./sanitize";

export interface CategorizeItem {
  text: string;
  type: "INCOME" | "EXPENSE";
}
export interface CategorizeResult {
  category: string | null;
  via: "rule" | "keyword" | "ai" | "none";
}

const MAX_AI_ITEMS = 40;
const schema = z.object({ items: z.array(z.object({ i: z.number().int(), category: z.string() })).max(MAX_AI_ITEMS) });

/**
 * Three tiers, cheapest first: the user's own learned rules, then a keyword dictionary, then (optionally) one AI call
 * for whatever is left. Identical merchants are sent once, and AI answers are remembered so they are free next time.
 */
export async function categorizeItems(user: AuthUser, items: CategorizeItem[], opts: { useAi: boolean }): Promise<{ results: CategorizeResult[]; aiError?: string }> {
  const rules = await loadRulesFor(user.id, items.map((i) => i.text));
  const results: CategorizeResult[] = items.map((item) => {
    const hit = resolveLocally(item.text, item.type, rules);
    return hit ? { category: hit.category, via: hit.via } : { category: null, via: "none" };
  });
  if (!opts.useAi) return { results };

  const pending = new Map<string, { type: "INCOME" | "EXPENSE"; text: string; indexes: number[] }>();
  results.forEach((r, idx) => {
    const item = items[idx] as CategorizeItem;
    const key = `${item.type}:${normalizeMerchant(item.text) || item.text.toLowerCase().slice(0, 40)}`;
    if (r.via !== "none" || !item.text.trim()) return;
    const entry = pending.get(key) ?? { type: item.type, text: item.text, indexes: [] };
    entry.indexes.push(idx);
    pending.set(key, entry);
  });
  const batch = [...pending.values()].slice(0, MAX_AI_ITEMS);
  if (batch.length === 0) return { results };

  try {
    assertAiAllowed(user);
    const { data } = await generateObject({
      feature: "categorize",
      userId: user.id,
      maxTokens: 600,
      schema,
      messages: [
        { role: "system", content: SYSTEM_BASE },
        {
          role: "user",
          content:
            `Assign one category id to each transaction. Return JSON: {"items":[{"i":number,"category":string}]}.\n` +
            `Use only ids valid for the given kind:\n${categoryCatalog("ALL")}\n\nTransactions:\n` +
            batch.map((b, i) => `${i}. [${b.type.toLowerCase()}] ${fence(b.text, 120)}`).join("\n"),
        },
      ],
    });
    for (const answer of data.items) {
      const target = batch[answer.i];
      if (!target || !isCategoryFor(answer.category, target.type)) continue;
      for (const idx of target.indexes) results[idx] = { category: answer.category, via: "ai" };
      await learnRule(db, user.id, target.text, answer.category, "AI");
    }
    return { results };
  } catch (err) {
    if (err instanceof AppError && err.code !== "VALIDATION") return { results, aiError: err.message };
    throw err;
  }
}

/** Re-files recent "Other" transactions. Returns how many changed. */
export async function cleanUpUncategorized(user: AuthUser): Promise<{ changed: number; checked: number; aiError?: string }> {
  const rows = await db.transaction.findMany({
    where: { userId: user.id, category: { in: ["other-expense", "other-income"] }, type: { in: ["INCOME", "EXPENSE"] } },
    orderBy: { date: "desc" },
    take: 80,
  });
  const candidates = rows.filter((r) => (r.merchant || r.description || "").trim().length > 0);
  if (candidates.length === 0) return { changed: 0, checked: 0 };
  const { results, aiError } = await categorizeItems(
    user,
    candidates.map((r) => ({ text: (r.merchant || r.description) as string, type: r.type as "INCOME" | "EXPENSE" })),
    { useAi: true },
  );
  const changes = candidates.flatMap((r, i) => {
    const res = results[i];
    return res?.category && res.category !== r.category && isCategoryFor(res.category, r.type) ? [{ id: r.id, category: res.category, ai: res.via === "ai" }] : [];
  });
  const changed = (await recategorize(user.id, changes.filter((c) => c.ai))) + (await recategorize(user.id, changes.filter((c) => !c.ai)));
  return { changed, checked: candidates.length, aiError };
}
