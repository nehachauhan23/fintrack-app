"use server";

import { db } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

const serializeDecimal = (obj) => {
  const s = { ...obj };
  if (obj.balance != null) s.balance = Number(obj.balance);
  if (obj.amount != null) s.amount = Number(obj.amount);
  return s;
};

export async function getAccountWithTransactions(accountId) {
  const session = await requireAuth();

  const account = await db.account.findUnique({
    where: { id: accountId, userId: session.id },
    include: {
      transactions: { orderBy: { date: "desc" } },
      _count: { select: { transactions: true } },
    },
  });

  if (!account) return null;

  return {
    ...serializeDecimal(account),
    transactions: account.transactions.map(serializeDecimal),
  };
}

export async function bulkDeleteTransactions(transactionIds) {
  try {
    const session = await requireAuth();

    const transactions = await db.transaction.findMany({
      where: { id: { in: transactionIds }, userId: session.id },
    });

    // Compute balance reversal per account
    const balanceChanges = transactions.reduce((acc, t) => {
      const delta = t.type === "EXPENSE" ? Number(t.amount) : -Number(t.amount);
      acc[t.accountId] = (acc[t.accountId] || 0) + delta;
      return acc;
    }, {});

    await db.$transaction(async (tx) => {
      await tx.transaction.deleteMany({
        where: { id: { in: transactionIds }, userId: session.id },
      });
      for (const [accountId, delta] of Object.entries(balanceChanges)) {
        await tx.account.update({
          where: { id: accountId },
          data: { balance: { increment: delta } },
        });
      }
    });

    revalidatePath("/dashboard");
    revalidatePath("/account/[id]");
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function updateDefaultAccount(accountId) {
  try {
    const session = await requireAuth();

    await db.account.updateMany({
      where: { userId: session.id, isDefault: true },
      data: { isDefault: false },
    });

    const account = await db.account.update({
      where: { id: accountId, userId: session.id },
      data: { isDefault: true },
    });

    revalidatePath("/dashboard");
    return { success: true, data: serializeDecimal(account) };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
