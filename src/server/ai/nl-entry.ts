import "server-only";
import { z } from "zod";
import { invalid } from "@/lib/errors";
import type { AuthUser } from "@/server/auth/session";
import { coerceAmount } from "@/domain/csv";
import { categoryName, isCategoryFor } from "@/domain/categories";
import { guessCategory } from "@/domain/merchant";
import { addDays, formatDateOnly, parseDateOnly } from "@/domain/periods";
import { assertAiAllowed, generateObject } from "./generate";
import { SYSTEM_BASE, categoryCatalog } from "./prompts";
import { fence } from "./sanitize";

const schema = z.object({
  entries: z
    .array(
      z.object({
        type: z.enum(["INCOME", "EXPENSE"]),
        amount: z.union([z.number(), z.string()]),
        description: z.string().max(160),
        merchant: z.string().max(80).nullish(),
        category: z.string().nullish(),
        date: z.string().nullish(),
        account: z.string().nullish(),
      }),
    )
    .max(5),
});

export interface EntryDraft {
  type: "INCOME" | "EXPENSE";
  amount: string;
  description: string;
  merchant: string | null;
  category: string;
  categoryName: string;
  date: string;
  accountId: string;
  accountName: string;
}

export interface AccountRef {
  id: string;
  name: string;
  isDefault: boolean;
}

/** Turns a note like "lunch 450 yesterday, cab 200 from hdfc" into reviewable transaction drafts. */
export async function parseEntries(user: AuthUser, text: string, today: string, accounts: AccountRef[]): Promise<{ entries: EntryDraft[] }> {
  assertAiAllowed(user);
  if (accounts.length === 0) throw invalid("Add an account first.");
  const todayDate = parseDateOnly(today) ?? parseDateOnly(formatDateOnly(new Date())) as Date;
  const fallbackAccount = accounts.find((a) => a.isDefault) ?? (accounts[0] as AccountRef);

  const { data } = await generateObject({
    feature: "nl-entry",
    userId: user.id,
    maxTokens: 700,
    schema,
    messages: [
      { role: "system", content: SYSTEM_BASE },
      {
        role: "user",
        content:
          `Today is ${formatDateOnly(todayDate)}. Accounts: ${accounts.map((a) => a.name).join(", ")}.\n` +
          `Turn the note into 1-5 transactions. Return JSON: {"entries":[{"type":"INCOME"|"EXPENSE","amount":number,"description":string,"merchant":string|null,"category":string,"date":"YYYY-MM-DD","account":string|null}]}.\n` +
          `Resolve relative dates ("yesterday", "last friday") from today. Use null for account unless one of the listed accounts is named. "amount" is positive. ` +
          `"category" must be one of these ids:\n${categoryCatalog("ALL")}\n\nNote: ${fence(text, 300)}`,
      },
    ],
  });

  const entries: EntryDraft[] = [];
  for (const e of data.entries) {
    const amount = coerceAmount(e.amount);
    if (!amount) continue;
    const label = [e.merchant, e.description].filter(Boolean).join(" ");
    const category = e.category && isCategoryFor(e.category, e.type) ? e.category : (guessCategory(label, e.type) ?? (e.type === "INCOME" ? "other-income" : "other-expense"));
    const parsed = e.date ? parseDateOnly(e.date) : null;
    const date = parsed && parsed <= addDays(todayDate, 1) ? formatDateOnly(parsed) : formatDateOnly(todayDate);
    const wanted = e.account?.trim().toLowerCase();
    const account = (wanted && accounts.find((a) => a.name.toLowerCase() === wanted || a.name.toLowerCase().includes(wanted) || wanted.includes(a.name.toLowerCase()))) || fallbackAccount;
    entries.push({ type: e.type, amount, description: e.description.trim() || label, merchant: e.merchant?.trim() || null, category, categoryName: categoryName(category), date, accountId: account.id, accountName: account.name });
  }
  if (entries.length === 0) throw invalid("I couldn't find an amount in that. Try something like \"lunch 450 yesterday\".");
  return { entries };
}
