"use server";

import { db } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
// import { redirect } from "next/navigation";
const serializeDecimal = (obj) => {
  const s = { ...obj };
  if (obj.balance != null) s.balance = Number(obj.balance);
  if (obj.amount != null) s.amount = Number(obj.amount);
  return s;
};

export async function getUserAccounts() {
  try {
    const session = await requireAuth();

    const accounts = await db.account.findMany({
      where: { userId: session.id },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { transactions: true } } },
    });

    return accounts.map(serializeDecimal);
  } catch (error) {
    console.error("[GET_USER_ACCOUNTS]", error);

    return [];
  }
}

export async function createAccount(data) {
  const session = await requireAuth();

  const balanceFloat = parseFloat(data.balance);
  if (isNaN(balanceFloat)) throw new Error("Invalid balance amount");

  const existingAccounts = await db.account.findMany({
    where: { userId: session.id },
  });

  const shouldBeDefault = existingAccounts.length === 0 ? true : data.isDefault;

  if (shouldBeDefault) {
    await db.account.updateMany({
      where: { userId: session.id, isDefault: true },
      data: { isDefault: false },
    });
  }

  const account = await db.account.create({
    data: {
      name: data.name,
      type: data.type,
      balance: balanceFloat,
      isDefault: shouldBeDefault,
      userId: session.id,
    },
  });

  revalidatePath("/dashboard");
  return { success: true, data: serializeDecimal(account) };
}

export async function getDashboardData() {
  const session = await requireAuth();
  console.log("session ", session);

  const transactions = await db.transaction.findMany({
    where: { userId: session.id },
    orderBy: { date: "desc" },
    take: 200, // limit for performance
  });

  return transactions.map(serializeDecimal);
}
