"use server";

import { db } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function getCurrentBudget(accountId) {
  const session = await requireAuth();

  const budget = await db.budget.findFirst({
    where: { userId: session.id },
  });

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const expenses = await db.transaction.aggregate({
    where: {
      userId: session.id,
      type: "EXPENSE",
      date: { gte: startOfMonth, lte: endOfMonth },
      accountId,
    },
    _sum: { amount: true },
  });

  return {
    budget: budget ? { ...budget, amount: Number(budget.amount) } : null,
    currentExpenses: expenses._sum.amount ? Number(expenses._sum.amount) : 0,
  };
}

export async function updateBudget(amount) {
  try {
    const session = await requireAuth();

    const budget = await db.budget.upsert({
      where: { userId: session.id },
      update: { amount },
      create: { userId: session.id, amount },
    });

    revalidatePath("/dashboard");
    return { success: true, data: { ...budget, amount: Number(budget.amount) } };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
