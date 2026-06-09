"use server";

import { db } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { subDays } from "date-fns";

const CATEGORIES = {
  INCOME: [
    { name: "salary", range: [5000, 8000] },
    { name: "freelance", range: [1000, 3000] },
    { name: "investments", range: [500, 2000] },
    { name: "other-income", range: [100, 1000] },
  ],
  EXPENSE: [
    { name: "housing", range: [1000, 2000] },
    { name: "transportation", range: [100, 500] },
    { name: "groceries", range: [200, 600] },
    { name: "utilities", range: [100, 300] },
    { name: "entertainment", range: [50, 200] },
    { name: "food", range: [50, 150] },
    { name: "shopping", range: [100, 500] },
    { name: "healthcare", range: [100, 1000] },
    { name: "education", range: [200, 1000] },
    { name: "travel", range: [500, 2000] },
  ],
};

function getRandomAmount(min, max) {
  return Number((Math.random() * (max - min) + min).toFixed(2));
}

function getRandomCategory(type) {
  const categories = CATEGORIES[type];
  const category = categories[Math.floor(Math.random() * categories.length)];
  return { category: category.name, amount: getRandomAmount(...category.range) };
}

export async function seedTransactions() {
  try {
    const session = await requireAuth();
    console.log("session : ",session);
    const account = await db.account.findFirst({
      where: { userId: session.id },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });

    console.log(account);
    

    if (!account) return { success: false, error: "No account found. Create an account first." };

    const transactions = [];
    let totalBalance = 0;

    for (let i = 90; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const perDay = Math.floor(Math.random() * 3) + 1;

      for (let j = 0; j < perDay; j++) {
        const type = Math.random() < 0.4 ? "INCOME" : "EXPENSE";
        const { category, amount } = getRandomCategory(type);
        transactions.push({
          id: crypto.randomUUID(),
          type,
          amount,
          description: `${type === "INCOME" ? "Received" : "Paid for"} ${category}`,
          date,
          category,
          status: "COMPLETED",
          userId: session.id,
          accountId: account.id,
          createdAt: date,
          updatedAt: date,
        });
        totalBalance += type === "INCOME" ? amount : -amount;
      }
    }

    await db.$transaction(async (tx) => {
      await tx.transaction.deleteMany({ where: { accountId: account.id } });
      await tx.transaction.createMany({ data: transactions });
      await tx.account.update({ where: { id: account.id }, data: { balance: totalBalance } });
    });

    return { success: true, message: `Created ${transactions.length} transactions` };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
