import "server-only";
import { randomUUID } from "node:crypto";
import type { TransactionSource, TransactionType } from "@/generated/prisma/client";
import { Prisma, db } from "@/server/db";
import { conflict, invalid, notFound } from "@/lib/errors";
import { directionOf, parseMoneyInput, type TransactionTypeName } from "@/domain/money";
import { TRANSFER_CATEGORY, isCategoryFor } from "@/domain/categories";
import { formatDateOnly, parseDateOnly } from "@/domain/periods";
import { importHash, type ParsedRow } from "@/domain/csv";
import { getOwnedAccount } from "./accounts";
import { learnRule, loadRulesFor, resolveLocally } from "./merchant-rules";

const D = Prisma.Decimal;
type Tx = Prisma.TransactionClient;

export interface TransactionView {
  id: string;
  accountId: string;
  accountName: string;
  type: TransactionType;
  amount: number;
  description: string | null;
  merchant: string | null;
  date: string;
  category: string;
  source: TransactionSource;
  aiCategorized: boolean;
  isTransfer: boolean;
  isRecurring: boolean;
}

type Row = Prisma.TransactionGetPayload<{ include: { account: { select: { name: true } } } }>;

const toView = (t: Row): TransactionView => ({
  id: t.id,
  accountId: t.accountId,
  accountName: t.account.name,
  type: t.type,
  amount: t.amount.toNumber(),
  description: t.description,
  merchant: t.merchant,
  date: formatDateOnly(t.date),
  category: t.category,
  source: t.source,
  aiCategorized: t.aiCategorized,
  isTransfer: t.type === "TRANSFER_IN" || t.type === "TRANSFER_OUT",
  isRecurring: t.recurringRuleId !== null,
});

const withAccount = { account: { select: { name: true } } } as const;
const signed = (type: TransactionTypeName, amount: Prisma.Decimal) => amount.mul(directionOf(type));

function requireDate(s: string): Date {
  const d = parseDateOnly(s);
  if (!d) throw invalid("Enter a valid date.", { date: ["Use the format YYYY-MM-DD"] });
  return d;
}

function requireAmount(s: string): Prisma.Decimal {
  const canonical = parseMoneyInput(s);
  if (!canonical) throw invalid("Enter an amount greater than zero, with at most two decimals.", { amount: ["Enter a valid amount"] });
  return new D(canonical);
}

// ───────────────────────────────────── Queries ─────────────────────────────────────

export interface TransactionFilters {
  q?: string;
  type?: "INCOME" | "EXPENSE" | "TRANSFER";
  category?: string;
  accountId?: string;
  from?: string;
  to?: string;
  min?: number;
  max?: number;
}

export function buildWhere(userId: string, f: TransactionFilters): Prisma.TransactionWhereInput {
  const where: Prisma.TransactionWhereInput = { userId };
  if (f.accountId) where.accountId = f.accountId;
  if (f.category) where.category = f.category;
  if (f.type === "TRANSFER") where.type = { in: ["TRANSFER_IN", "TRANSFER_OUT"] };
  else if (f.type) where.type = f.type;
  const from = f.from ? parseDateOnly(f.from) : null;
  const to = f.to ? parseDateOnly(f.to) : null;
  if (from || to) where.date = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
  if (f.min !== undefined || f.max !== undefined) {
    where.amount = { ...(f.min !== undefined ? { gte: new D(f.min) } : {}), ...(f.max !== undefined ? { lte: new D(f.max) } : {}) };
  }
  const q = f.q?.trim().slice(0, 100);
  if (q) where.OR = [{ description: { contains: q, mode: "insensitive" } }, { merchant: { contains: q, mode: "insensitive" } }];
  return where;
}

export interface TransactionPage {
  items: TransactionView[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  income: number;
  expense: number;
}

export async function listTransactions(userId: string, filters: TransactionFilters, page = 1, pageSize = 25): Promise<TransactionPage> {
  const size = Math.min(100, Math.max(1, pageSize));
  const where = buildWhere(userId, filters);
  const [total, sums] = await Promise.all([
    db.transaction.count({ where }),
    db.transaction.groupBy({ by: ["type"], where, _sum: { amount: true } }),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(1, page), pageCount);
  const rows = await db.transaction.findMany({
    where,
    include: withAccount,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    skip: (current - 1) * size,
    take: size,
  });
  const sumOf = (t: TransactionType) => sums.find((s) => s.type === t)?._sum.amount?.toNumber() ?? 0;
  return { items: rows.map(toView), total, page: current, pageSize: size, pageCount, income: sumOf("INCOME"), expense: sumOf("EXPENSE") };
}

export async function recentTransactions(userId: string, take = 8): Promise<TransactionView[]> {
  const rows = await db.transaction.findMany({ where: { userId }, include: withAccount, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take });
  return rows.map(toView);
}

/** Streams every matching row in batches so exports use constant memory. */
export async function* iterateTransactions(userId: string, filters: TransactionFilters, batch = 500): AsyncGenerator<TransactionView[]> {
  const where = buildWhere(userId, filters);
  let cursor: string | undefined;
  for (;;) {
    const rows = await db.transaction.findMany({
      where,
      include: withAccount,
      orderBy: [{ date: "desc" }, { id: "asc" }],
      take: batch,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (rows.length === 0) return;
    yield rows.map(toView);
    cursor = rows[rows.length - 1]?.id;
    if (rows.length < batch) return;
  }
}

// ───────────────────────────────────── Commands ─────────────────────────────────────

export interface CreateTransactionInput {
  accountId: string;
  type: "INCOME" | "EXPENSE";
  amount: string;
  date: string;
  category?: string;
  description?: string;
  merchant?: string;
  source?: TransactionSource;
  aiCategorized?: boolean;
}

export async function createTransaction(userId: string, input: CreateTransactionInput): Promise<TransactionView> {
  const amount = requireAmount(input.amount);
  const date = requireDate(input.date);
  return db.$transaction(async (tx) => {
    await getOwnedAccount(userId, input.accountId, {}, tx);
    let category = input.category;
    let aiCategorized = input.aiCategorized ?? false;
    if (!category) {
      const text = [input.merchant, input.description].filter(Boolean).join(" ");
      const rules = await loadRulesFor(userId, [text], tx);
      category = resolveLocally(text, input.type, rules)?.category ?? (input.type === "INCOME" ? "other-income" : "other-expense");
      aiCategorized = false;
    }
    if (!isCategoryFor(category, input.type)) throw invalid("That category does not match the transaction type.", { category: ["Pick a matching category"] });
    const created = await tx.transaction.create({
      data: {
        userId,
        accountId: input.accountId,
        type: input.type,
        amount,
        date,
        category,
        description: input.description?.trim() || null,
        merchant: input.merchant?.trim() || null,
        source: input.source ?? "MANUAL",
        aiCategorized,
      },
      include: withAccount,
    });
    // Atomic, DB-side arithmetic: concurrent writes can never lose an update.
    await tx.account.update({ where: { id: input.accountId }, data: { balance: { increment: signed(input.type, amount) } } });
    if (!aiCategorized) await learnRule(tx, userId, input.merchant || input.description, category);
    return toView(created);
  });
}

export interface UpdateTransactionInput {
  accountId?: string;
  type?: "INCOME" | "EXPENSE";
  amount?: string;
  date?: string;
  category?: string;
  description?: string | null;
  merchant?: string | null;
}

export async function updateTransaction(userId: string, id: string, input: UpdateTransactionInput): Promise<TransactionView> {
  return db.$transaction(async (tx) => {
    const existing = await tx.transaction.findFirst({ where: { id, userId } });
    if (!existing) throw notFound("Transaction");
    const isTransferLeg = existing.type === "TRANSFER_IN" || existing.type === "TRANSFER_OUT";
    if (isTransferLeg && (input.amount || input.type || input.accountId)) {
      throw conflict("Transfers can't change amount or account. Delete the transfer and create a new one.");
    }
    const type = (input.type ?? existing.type) as TransactionTypeName;
    const amount = input.amount ? requireAmount(input.amount) : existing.amount;
    const accountId = input.accountId ?? existing.accountId;
    const category = input.category ?? (input.type && input.type !== existing.type ? (type === "INCOME" ? "other-income" : "other-expense") : existing.category);
    if (!isCategoryFor(category, type)) throw invalid("That category does not match the transaction type.", { category: ["Pick a matching category"] });
    if (accountId !== existing.accountId) await getOwnedAccount(userId, accountId, {}, tx);

    const oldDelta = signed(existing.type, existing.amount);
    const newDelta = signed(type, amount);
    if (accountId === existing.accountId) {
      const diff = newDelta.minus(oldDelta);
      if (!diff.isZero()) await tx.account.update({ where: { id: accountId }, data: { balance: { increment: diff } } });
    } else {
      await tx.account.update({ where: { id: existing.accountId }, data: { balance: { decrement: oldDelta } } });
      await tx.account.update({ where: { id: accountId }, data: { balance: { increment: newDelta } } });
    }
    const updated = await tx.transaction.update({
      where: { id },
      data: {
        accountId,
        type: type as TransactionType,
        amount,
        category,
        date: input.date ? requireDate(input.date) : undefined,
        description: input.description === undefined ? undefined : input.description?.trim() || null,
        merchant: input.merchant === undefined ? undefined : input.merchant?.trim() || null,
        aiCategorized: input.category && input.category !== existing.category ? false : existing.aiCategorized,
      },
      include: withAccount,
    });
    if (input.category && input.category !== existing.category) await learnRule(tx, userId, updated.merchant || updated.description, input.category);
    return toView(updated);
  });
}

/** Deletes rows (plus the sibling leg of any transfer) and reverses their effect on balances, atomically. */
async function deleteRows(tx: Tx, userId: string, ids: string[]): Promise<number> {
  const rows = await tx.transaction.findMany({ where: { userId, id: { in: ids } } });
  if (rows.length === 0) return 0;
  const groups = [...new Set(rows.map((r) => r.transferGroupId).filter((g): g is string => !!g))];
  const siblings = groups.length ? await tx.transaction.findMany({ where: { userId, transferGroupId: { in: groups } } }) : [];
  const all = new Map([...rows, ...siblings].map((r) => [r.id, r]));
  const perAccount = new Map<string, Prisma.Decimal>();
  for (const r of all.values()) perAccount.set(r.accountId, (perAccount.get(r.accountId) ?? new D(0)).plus(signed(r.type, r.amount)));
  await tx.transaction.deleteMany({ where: { userId, id: { in: [...all.keys()] } } });
  for (const [accountId, delta] of perAccount) {
    if (!delta.isZero()) await tx.account.update({ where: { id: accountId }, data: { balance: { decrement: delta } } });
  }
  return all.size;
}

export async function deleteTransaction(userId: string, id: string): Promise<void> {
  const n = await db.$transaction((tx) => deleteRows(tx, userId, [id]));
  if (n === 0) throw notFound("Transaction");
}

export async function bulkDeleteTransactions(userId: string, ids: string[]): Promise<number> {
  if (ids.length > 200) throw invalid("Delete at most 200 transactions at once.");
  return db.$transaction((tx) => deleteRows(tx, userId, ids));
}

export async function createTransfer(userId: string, input: { fromAccountId: string; toAccountId: string; amount: string; date: string; note?: string }): Promise<{ groupId: string }> {
  if (input.fromAccountId === input.toAccountId) throw invalid("Choose two different accounts.", { toAccountId: ["Must differ from the source account"] });
  const amount = requireAmount(input.amount);
  const date = requireDate(input.date);
  const groupId = randomUUID();
  await db.$transaction(async (tx) => {
    const from = await getOwnedAccount(userId, input.fromAccountId, {}, tx);
    const to = await getOwnedAccount(userId, input.toAccountId, {}, tx);
    const base = { userId, amount, date, category: TRANSFER_CATEGORY, source: "TRANSFER" as const, transferGroupId: groupId };
    await tx.transaction.create({ data: { ...base, accountId: from.id, type: "TRANSFER_OUT", description: input.note?.trim() || `Transfer to ${to.name}` } });
    await tx.transaction.create({ data: { ...base, accountId: to.id, type: "TRANSFER_IN", description: input.note?.trim() || `Transfer from ${from.name}` } });
    await tx.account.update({ where: { id: from.id }, data: { balance: { decrement: amount } } });
    await tx.account.update({ where: { id: to.id }, data: { balance: { increment: amount } } });
  });
  return { groupId };
}

/** Applies a category to many income/expense rows (used when accepting AI suggestions). */
export async function recategorize(userId: string, items: { id: string; category: string; ai?: boolean }[]): Promise<number> {
  return db.$transaction(async (tx) => {
    const rows = await tx.transaction.findMany({ where: { userId, id: { in: items.map((i) => i.id) } } });
    const byId = new Map(rows.map((r) => [r.id, r]));
    let changed = 0;
    for (const item of items) {
      const row = byId.get(item.id);
      if (!row || row.type === "TRANSFER_IN" || row.type === "TRANSFER_OUT") continue;
      if (!isCategoryFor(item.category, row.type)) continue;
      await tx.transaction.update({ where: { id: row.id }, data: { category: item.category, aiCategorized: item.ai ?? false } });
      await learnRule(tx, userId, row.merchant || row.description, item.category, item.ai ? "AI" : "USER");
      changed++;
    }
    return changed;
  });
}

export interface ImportResult {
  inserted: number;
  skipped: number;
}

/**
 * Imports parsed CSV rows. Re-importing the same file is a no-op thanks to a per-row dedupe hash,
 * and the account balance moves only by the rows that were actually inserted.
 */
export async function importTransactions(
  userId: string,
  accountId: string,
  rows: (Pick<ParsedRow, "date" | "type" | "amount" | "description"> & { category?: string })[],
): Promise<ImportResult> {
  if (rows.length === 0) return { inserted: 0, skipped: 0 };
  if (rows.length > 2000) throw invalid("Import at most 2,000 rows at a time.");
  return db.$transaction(async (tx) => {
    await getOwnedAccount(userId, accountId, {}, tx);
    for (const [i, r] of rows.entries()) {
      if (parseMoneyInput(r.amount) !== r.amount || !parseDateOnly(r.date)) throw invalid(`Row ${i + 1} has an invalid amount or date.`);
    }
    const seen = new Map<string, number>();
    const hashed = rows.map((r) => {
      const base = `${r.date}|${r.type}|${r.amount}|${r.description.toLowerCase().trim()}`;
      const occurrence = seen.get(base) ?? 0;
      seen.set(base, occurrence + 1);
      return { row: r, hash: importHash(accountId, r, occurrence) };
    });
    const existing = await tx.transaction.findMany({ where: { userId, importHash: { in: hashed.map((h) => h.hash) } }, select: { importHash: true } });
    const known = new Set(existing.map((e) => e.importHash));
    const fresh = hashed.filter((h) => !known.has(h.hash));
    const rules = await loadRulesFor(userId, rows.map((r) => r.description), tx);
    let delta = new D(0);
    const data = fresh.map(({ row, hash }) => {
      const amount = new D(row.amount);
      delta = delta.plus(signed(row.type, amount));
      const fallback = row.type === "INCOME" ? "other-income" : "other-expense";
      const category = row.category && isCategoryFor(row.category, row.type) ? row.category : (resolveLocally(row.description, row.type, rules)?.category ?? fallback);
      return {
        userId,
        accountId,
        type: row.type as TransactionType,
        amount,
        date: parseDateOnly(row.date) as Date,
        category,
        description: row.description || null,
        source: "CSV_IMPORT" as const,
        importHash: hash,
      };
    });
    if (data.length > 0) {
      await tx.transaction.createMany({ data });
      await tx.account.update({ where: { id: accountId }, data: { balance: { increment: delta } } });
    }
    return { inserted: data.length, skipped: rows.length - data.length };
  });
}
