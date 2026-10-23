"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import * as S from "./schemas";
import { authedAction } from "./safe-action";
import { listAccounts } from "@/server/services/accounts";
import { scanReceipt } from "@/server/ai/receipt";
import { parseEntries } from "@/server/ai/nl-entry";
import { categorizeItems, cleanUpUncategorized } from "@/server/ai/categorize";
import { askAssistant, planSchema } from "@/server/ai/assistant";
import { getMonthlyInsight } from "@/server/ai/insights";
import { suggestBudgets } from "@/server/ai/budget-suggest";

const AI_LIMIT = { limit: 15, windowSec: 60 };

export const scanReceiptAction = authedAction({
  name: "ai.receipt",
  rateLimit: AI_LIMIT,
  input: z.object({ imageBase64: z.string().min(100).max(6_000_000), today: S.dateStr }),
  handler: async ({ imageBase64, today }, { user }) => scanReceipt(user, imageBase64, today),
});

export const parseEntryAction = authedAction({
  name: "ai.entry",
  rateLimit: AI_LIMIT,
  input: z.object({ text: S.text(300).min(2, "Describe the transaction"), today: S.dateStr }),
  handler: async ({ text, today }, { user }) => parseEntries(user, text, today, await listAccounts(user.id)),
});

export const categorizeRowsAction = authedAction({
  name: "ai.categorize",
  rateLimit: AI_LIMIT,
  input: z.object({ items: z.array(z.object({ text: S.text(200), type: z.enum(["INCOME", "EXPENSE"]) })).min(1).max(200) }),
  handler: async ({ items }, { user }) => categorizeItems(user, items, { useAi: true }),
});

export const cleanUpCategoriesAction = authedAction({
  name: "ai.cleanup",
  rateLimit: AI_LIMIT,
  input: z.object({}),
  handler: async (_input, { user }) => {
    const result = await cleanUpUncategorized(user);
    if (result.changed > 0) revalidatePath("/", "layout");
    return result;
  },
});

export const askAssistantAction = authedAction({
  name: "ai.ask",
  rateLimit: AI_LIMIT,
  input: z.object({
    question: S.text(300).min(2, "Ask a question"),
    today: S.dateStr,
    history: z.array(z.object({ question: S.text(300), plan: planSchema })).max(2).default([]),
  }),
  handler: async ({ question, today, history }, { user }) => askAssistant(user, question, today, await listAccounts(user.id), history),
});

export const getInsightAction = authedAction({
  name: "ai.insight",
  rateLimit: AI_LIMIT,
  input: z.object({ period: S.periodKey, refresh: z.boolean().default(false) }),
  handler: async ({ period, refresh }, { user }) => getMonthlyInsight(user, period, { refresh }),
});

export const suggestBudgetsAction = authedAction({
  name: "ai.budgets",
  rateLimit: AI_LIMIT,
  input: z.object({ useAi: z.boolean().default(true) }),
  handler: async ({ useAi }, { user }) => suggestBudgets(user, { useAi }),
});
