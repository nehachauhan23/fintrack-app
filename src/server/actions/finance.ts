"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/server/audit";
import * as S from "./schemas";
import { authedAction } from "./safe-action";
import { archiveAccount, createAccount, deleteEmptyAccount, reconcileAccount, restoreAccount, setDefaultAccount, updateAccount } from "@/server/services/accounts";
import { bulkDeleteTransactions, createTransaction, createTransfer, deleteTransaction, importTransactions, updateTransaction } from "@/server/services/transactions";
import { previewCsv } from "@/server/services/csv-import";
import { removeBudget, setBudget } from "@/server/services/budgets";
import { archiveGoal, contributeToGoal, createGoal, updateGoal } from "@/server/services/goals";
import { createRule, deleteRule, updateRule } from "@/server/services/recurring";

const touch = () => revalidatePath("/", "layout");
/** Awaits the mutation first, then invalidates cached pages, so a render can never observe the old data. */
const done = async <T,>(work: Promise<T>): Promise<T> => {
  const result = await work;
  touch();
  return result;
};
const accountType = z.enum(["CURRENT", "SAVINGS", "CREDIT_CARD", "CASH", "INVESTMENT"]);

// ─────────────────────────────── Accounts ───────────────────────────────
export const createAccountAction = authedAction({
  name: "account.create",
  input: z.object({ name: S.text(60).min(1, "Give the account a name"), type: accountType, openingBalance: z.string().max(24), isDefault: z.boolean().optional() }),
  handler: async (input, { user }) => done(createAccount(user.id, input)),
});
export const updateAccountAction = authedAction({
  name: "account.update",
  input: z.object({ id: S.id, name: S.text(60).min(1).optional(), type: accountType.optional() }),
  handler: async ({ id, ...rest }, { user }) => done(updateAccount(user.id, id, rest)),
});
export const setDefaultAccountAction = authedAction({ name: "account.default", input: z.object({ id: S.id }), handler: async ({ id }, { user }) => (await setDefaultAccount(user.id, id), touch(), { ok: true as const }) });
export const archiveAccountAction = authedAction({ name: "account.archive", input: z.object({ id: S.id }), handler: async ({ id }, { user }) => (await archiveAccount(user.id, id), touch(), { ok: true as const }) });
export const restoreAccountAction = authedAction({ name: "account.restore", input: z.object({ id: S.id }), handler: async ({ id }, { user }) => (await restoreAccount(user.id, id), touch(), { ok: true as const }) });
export const deleteAccountPermanentlyAction = authedAction({ name: "account.delete", input: z.object({ id: S.id }), handler: async ({ id }, { user }) => (await deleteEmptyAccount(user.id, id), touch(), { ok: true as const }) });
export const reconcileAccountAction = authedAction({
  name: "account.reconcile",
  input: z.object({ id: S.id, fix: z.boolean().default(false) }),
  handler: async ({ id, fix }, { user }) => {
    const report = await reconcileAccount(user.id, id, fix);
    if (report.fixed) {
      await audit("account.reconciled", { userId: user.id, entity: "account", entityId: id, meta: { drift: report.drift } });
      touch();
    }
    return report;
  },
});

// ───────────────────────────── Transactions ─────────────────────────────
export const createTransactionAction = authedAction({
  name: "transaction.create",
  input: z.object({
    accountId: S.id,
    type: z.enum(["INCOME", "EXPENSE"]),
    amount: S.money,
    date: S.notFutureDate,
    category: S.category.optional(),
    description: S.text(200).optional(),
    merchant: S.text(80).optional(),
    source: z.enum(["MANUAL", "RECEIPT_SCAN", "AI_ENTRY"]).default("MANUAL"),
    aiCategorized: z.boolean().optional(),
  }),
  handler: async (input, { user }) => done(createTransaction(user.id, input)),
});
export const updateTransactionAction = authedAction({
  name: "transaction.update",
  input: z.object({
    id: S.id,
    accountId: S.id.optional(),
    type: z.enum(["INCOME", "EXPENSE"]).optional(),
    amount: S.money.optional(),
    date: S.notFutureDate.optional(),
    category: S.category.optional(),
    description: S.text(200).nullable().optional(),
    merchant: S.text(80).nullable().optional(),
  }),
  handler: async ({ id, ...rest }, { user }) => done(updateTransaction(user.id, id, rest)),
});
export const deleteTransactionAction = authedAction({ name: "transaction.delete", input: z.object({ id: S.id }), handler: async ({ id }, { user }) => (await deleteTransaction(user.id, id), touch(), { ok: true as const }) });
export const bulkDeleteTransactionsAction = authedAction({
  name: "transaction.bulk-delete",
  input: z.object({ ids: z.array(S.id).min(1).max(200) }),
  handler: async ({ ids }, { user }) => {
    const deleted = await bulkDeleteTransactions(user.id, ids);
    await audit("transactions.bulk_delete", { userId: user.id, meta: { deleted } });
    touch();
    return { deleted };
  },
});
export const createTransferAction = authedAction({
  name: "transaction.transfer",
  input: z.object({ fromAccountId: S.id, toAccountId: S.id, amount: S.money, date: S.notFutureDate, note: S.text(120).optional() }),
  handler: async (input, { user }) => (await createTransfer(user.id, input), touch(), { ok: true as const }),
});

// ───────────────────────────────── CSV ─────────────────────────────────
export const previewCsvAction = authedAction({
  name: "csv.preview",
  rateLimit: { limit: 20, windowSec: 60 },
  input: z.object({
    csv: z.string().min(1).max(1_500_000),
    dateOrder: z.enum(["dmy", "mdy"]).default("dmy"),
    invertSign: z.boolean().default(false),
    mapping: z.object({ date: z.string().max(100).optional(), description: z.string().max(100).optional(), amount: z.string().max(100).optional(), debit: z.string().max(100).optional(), credit: z.string().max(100).optional() }).optional(),
  }),
  handler: async (input, { user }) => previewCsv(user.id, input.csv, { dateOrder: input.dateOrder, invertSign: input.invertSign, mapping: input.mapping }),
});
export const importCsvAction = authedAction({
  name: "csv.import",
  rateLimit: { limit: 10, windowSec: 60 },
  input: z.object({
    accountId: S.id,
    rows: z.array(z.object({ date: S.dateStr, type: z.enum(["INCOME", "EXPENSE"]), amount: S.money, description: S.text(200), category: S.category.optional() })).min(1).max(2000),
  }),
  handler: async ({ accountId, rows }, { user }) => {
    const result = await importTransactions(user.id, accountId, rows);
    await audit("transactions.import", { userId: user.id, entity: "account", entityId: accountId, meta: { inserted: result.inserted, skipped: result.skipped } });
    touch();
    return result;
  },
});

// ─────────────────────────── Budgets, goals, rules ───────────────────────────
export const setBudgetAction = authedAction({ name: "budget.set", input: z.object({ category: S.category, amount: S.money }), handler: async ({ category, amount }, { user }) => (await setBudget(user.id, category, amount), touch(), { ok: true as const }) });
export const removeBudgetAction = authedAction({ name: "budget.remove", input: z.object({ category: S.category }), handler: async ({ category }, { user }) => (await removeBudget(user.id, category), touch(), { ok: true as const }) });

export const createGoalAction = authedAction({
  name: "goal.create",
  input: z.object({ name: S.text(80).min(1, "Name your goal"), targetAmount: S.money, deadline: S.dateStr.nullable().optional() }),
  handler: async (input, { user }) => done(createGoal(user.id, input)),
});
export const updateGoalAction = authedAction({
  name: "goal.update",
  input: z.object({ id: S.id, name: S.text(80).min(1).optional(), targetAmount: S.money.optional(), deadline: S.dateStr.nullable().optional() }),
  handler: async ({ id, ...rest }, { user }) => done(updateGoal(user.id, id, rest)),
});
export const archiveGoalAction = authedAction({ name: "goal.archive", input: z.object({ id: S.id }), handler: async ({ id }, { user }) => (await archiveGoal(user.id, id), touch(), { ok: true as const }) });
export const contributeToGoalAction = authedAction({
  name: "goal.contribute",
  input: z.object({ id: S.id, kind: z.enum(["deposit", "withdraw"]), amount: S.money, note: S.text(120).optional(), date: S.notFutureDate }),
  handler: async ({ id, ...rest }, { user }) => done(contributeToGoal(user.id, id, rest)),
});

export const createRuleAction = authedAction({
  name: "recurring.create",
  input: z.object({
    accountId: S.id,
    type: z.enum(["INCOME", "EXPENSE"]),
    amount: S.money,
    category: S.category,
    description: S.text(120).optional(),
    merchant: S.text(80).optional(),
    interval: z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]),
    startDate: S.dateStr,
    endDate: S.dateStr.nullable().optional(),
  }),
  handler: async (input, { user }) => done(createRule(user.id, input)),
});
export const updateRuleAction = authedAction({
  name: "recurring.update",
  input: z.object({ id: S.id, amount: S.money.optional(), category: S.category.optional(), description: S.text(120).nullable().optional(), endDate: S.dateStr.nullable().optional(), isActive: z.boolean().optional() }),
  handler: async ({ id, ...rest }, { user }) => done(updateRule(user.id, id, rest)),
});
export const deleteRuleAction = authedAction({ name: "recurring.delete", input: z.object({ id: S.id }), handler: async ({ id }, { user }) => (await deleteRule(user.id, id), touch(), { ok: true as const }) });
