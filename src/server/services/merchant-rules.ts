import "server-only";
import type { RuleSource } from "@/generated/prisma/client";
import { type Prisma, db } from "@/server/db";
import { guessCategory, normalizeMerchant } from "@/domain/merchant";
import { isCategoryFor } from "@/domain/categories";

type Client = Prisma.TransactionClient | typeof db;

/**
 * Remembers "this merchant → this category". A user's own choice always wins; AI suggestions never overwrite a user rule.
 */
export async function learnRule(client: Client, userId: string, text: string | null | undefined, category: string, source: RuleSource = "USER"): Promise<void> {
  const key = normalizeMerchant(text ?? "");
  if (key.length < 3) return;
  // "Other" is the absence of a decision. Remembering it would pin the merchant to the catch-all forever.
  if (category.startsWith("other-")) return;
  if (source === "AI") {
    await client.merchantRule.createMany({ data: [{ userId, key, category, source }], skipDuplicates: true });
    return;
  }
  await client.merchantRule.upsert({
    where: { userId_key: { userId, key } },
    create: { userId, key, category, source },
    update: { category, source, hits: { increment: 1 } },
  });
}

export async function loadRules(userId: string, keys: string[], client: Client = db): Promise<Map<string, string>> {
  const unique = [...new Set(keys.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const rows = await client.merchantRule.findMany({ where: { userId, key: { in: unique } }, select: { key: true, category: true } });
  return new Map(rows.map((r) => [r.key, r.category]));
}

/** Convenience: derives the normalised keys from raw descriptions, then loads the matching rules. */
export function loadRulesFor(userId: string, texts: (string | null | undefined)[], client: Client = db): Promise<Map<string, string>> {
  return loadRules(userId, texts.map((t) => normalizeMerchant(t ?? "")), client);
}

export type CategoryResolution = { category: string; via: "rule" | "keyword" } | null;

/** Cheap, deterministic categorisation: learned rule first, then the keyword dictionary. Null means "ask the AI or the user". */
export function resolveLocally(
  text: string,
  type: "INCOME" | "EXPENSE",
  rules: Map<string, string>,
): CategoryResolution {
  const key = normalizeMerchant(text);
  const ruled = key ? rules.get(key) : undefined;
  if (ruled && isCategoryFor(ruled, type)) return { category: ruled, via: "rule" };
  const guessed = guessCategory(text, type);
  return guessed ? { category: guessed, via: "keyword" } : null;
}
