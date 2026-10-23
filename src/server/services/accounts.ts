import "server-only";
import type { Account, AccountType } from "@/generated/prisma/client";
import { Prisma, db } from "@/server/db";
import { conflict, invalid, notFound } from "@/lib/errors";
import { parseBalanceInput } from "@/domain/money";

const D = Prisma.Decimal;

export interface AccountView {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  isDefault: boolean;
  archived: boolean;
}

export const toAccountView = (a: Account): AccountView => ({
  id: a.id,
  name: a.name,
  type: a.type,
  balance: a.balance.toNumber(),
  isDefault: a.isDefault,
  archived: a.archivedAt !== null,
});

/** Loads an account only if it belongs to the user; the single place ownership is checked. */
export async function getOwnedAccount(userId: string, id: string, opts: { allowArchived?: boolean } = {}, client: Prisma.TransactionClient | typeof db = db): Promise<Account> {
  const a = await client.account.findFirst({ where: { id, userId, ...(opts.allowArchived ? {} : { archivedAt: null }) } });
  if (!a) throw notFound("Account");
  return a;
}

export async function listAccounts(userId: string, opts: { includeArchived?: boolean } = {}): Promise<AccountView[]> {
  const rows = await db.account.findMany({
    where: { userId, ...(opts.includeArchived ? {} : { archivedAt: null }) },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
  return rows.map(toAccountView);
}

export async function getAccountView(userId: string, id: string): Promise<AccountView> {
  return toAccountView(await getOwnedAccount(userId, id, { allowArchived: true }));
}

export async function createAccount(userId: string, input: { name: string; type: AccountType; openingBalance: string; isDefault?: boolean }): Promise<AccountView> {
  const opening = parseBalanceInput(input.openingBalance);
  if (opening === null) throw invalid("Enter a valid opening balance.", { openingBalance: ["Enter a valid amount, e.g. 1250.00"] });
  return db.$transaction(async (tx) => {
    const active = await tx.account.count({ where: { userId, archivedAt: null } });
    const makeDefault = input.isDefault === true || active === 0;
    if (makeDefault) await tx.account.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
    const created = await tx.account.create({
      data: { userId, name: input.name.trim(), type: input.type, balance: new D(opening), openingBalance: new D(opening), isDefault: makeDefault },
    });
    return toAccountView(created);
  });
}

export async function updateAccount(userId: string, id: string, input: { name?: string; type?: AccountType }): Promise<AccountView> {
  await getOwnedAccount(userId, id, { allowArchived: true });
  const updated = await db.account.update({ where: { id }, data: { name: input.name?.trim(), type: input.type } });
  return toAccountView(updated);
}

export async function setDefaultAccount(userId: string, id: string): Promise<void> {
  await db.$transaction(async (tx) => {
    await getOwnedAccount(userId, id, {}, tx);
    await tx.account.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
    await tx.account.update({ where: { id }, data: { isDefault: true } });
  });
}

/** Archiving keeps history intact. If the default account is archived, the oldest remaining account takes over. */
export async function archiveAccount(userId: string, id: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const acc = await getOwnedAccount(userId, id, {}, tx);
    await tx.recurringRule.updateMany({ where: { accountId: id }, data: { isActive: false } });
    await tx.account.update({ where: { id }, data: { archivedAt: new Date(), isDefault: false } });
    if (acc.isDefault) {
      const next = await tx.account.findFirst({ where: { userId, archivedAt: null, id: { not: id } }, orderBy: { createdAt: "asc" } });
      if (next) await tx.account.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  });
}

export async function restoreAccount(userId: string, id: string): Promise<void> {
  await getOwnedAccount(userId, id, { allowArchived: true });
  await db.account.update({ where: { id }, data: { archivedAt: null } });
}

/** Hard delete is only allowed for an empty account; otherwise archive it. */
export async function deleteEmptyAccount(userId: string, id: string): Promise<void> {
  await getOwnedAccount(userId, id, { allowArchived: true });
  const count = await db.transaction.count({ where: { accountId: id } });
  if (count > 0) throw conflict("This account has transactions. Archive it instead.");
  await db.account.delete({ where: { id } });
}

export async function netWorth(userId: string): Promise<number> {
  const r = await db.account.aggregate({ where: { userId, archivedAt: null }, _sum: { balance: true } });
  return r._sum.balance?.toNumber() ?? 0;
}

export interface ReconcileReport {
  accountId: string;
  stored: number;
  expected: number;
  drift: number;
  fixed: boolean;
}

/**
 * Verifies the ledger invariant balance = openingBalance + Σ signed(transactions).
 * With `fix`, the stored balance is rewritten to the recomputed value.
 */
export async function reconcileAccount(userId: string, id: string, fix = false): Promise<ReconcileReport> {
  const acc = await getOwnedAccount(userId, id, { allowArchived: true });
  const rows = await db.$queryRaw<{ sum: unknown }[]>`
    SELECT COALESCE(SUM(CASE WHEN "type" IN ('INCOME'::"TransactionType", 'TRANSFER_IN'::"TransactionType") THEN "amount" ELSE -"amount" END), 0) AS sum
    FROM transactions WHERE "accountId" = ${id} AND "userId" = ${userId}`;
  const expected = acc.openingBalance.plus(new D(String(rows[0]?.sum ?? 0)));
  const drift = acc.balance.minus(expected);
  const needsFix = !drift.isZero();
  if (fix && needsFix) await db.account.update({ where: { id }, data: { balance: expected } });
  return { accountId: id, stored: acc.balance.toNumber(), expected: expected.toNumber(), drift: drift.toNumber(), fixed: fix && needsFix };
}
