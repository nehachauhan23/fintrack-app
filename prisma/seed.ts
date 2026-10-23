/**
 * Development seed: a demo user with ~6 months of realistic activity.
 *   npm run db:seed        (refuses to run in production)
 * Login: demo@fintrack.dev / demo-password-123
 */
import { db } from "@/server/db";
import { registerUser } from "@/server/services/auth";
import { createAccount } from "@/server/services/accounts";
import { createTransaction, createTransfer } from "@/server/services/transactions";
import { createRule } from "@/server/services/recurring";
import { setBudget } from "@/server/services/budgets";
import { contributeToGoal, createGoal } from "@/server/services/goals";
import { addDays, formatDateOnly, utcToday } from "@/domain/periods";

if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed a production database.");

const EMAIL = "demo@fintrack.dev";

function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SPEND: { category: string; merchants: string[]; min: number; max: number; weight: number }[] = [
  { category: "groceries", merchants: ["Whole Foods", "Trader Joe's", "Costco"], min: 28, max: 140, weight: 0.22 },
  { category: "food", merchants: ["Blue Bottle Coffee", "Chipotle", "Sushi Den", "Pizza Hut"], min: 6, max: 48, weight: 0.4 },
  { category: "transportation", merchants: ["Uber", "Shell", "Metro card"], min: 8, max: 55, weight: 0.18 },
  { category: "shopping", merchants: ["Amazon", "IKEA", "Uniqlo"], min: 18, max: 160, weight: 0.1 },
  { category: "healthcare", merchants: ["CVS Pharmacy"], min: 10, max: 60, weight: 0.03 },
  { category: "travel", merchants: ["Delta Airlines"], min: 120, max: 420, weight: 0.012 },
];

async function main() {
  await db.user.deleteMany({ where: { email: EMAIL } });
  const { id: userId } = await registerUser({ name: "Demo User", email: EMAIL, password: "demo-password-123" });
  await db.user.update({ where: { id: userId }, data: { currency: "USD" } });

  const everyday = await createAccount(userId, { name: "Everyday", type: "CURRENT", openingBalance: "2400.00", isDefault: true });
  const savings = await createAccount(userId, { name: "Savings", type: "SAVINGS", openingBalance: "8000.00" });
  const card = await createAccount(userId, { name: "Credit card", type: "CREDIT_CARD", openingBalance: "-320.00" });

  const today = utcToday();
  const start = addDays(today, -183);
  const startStr = (d: number) => formatDateOnly(addDays(start, d));
  const firstOfMonth = (offset: number) => { const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - offset, 1)); return formatDateOnly(d); };

  for (const [description, type, amount, category, day] of [
    ["Salary, Acme Ltd", "INCOME", "5200.00", "salary", 1], ["Rent", "EXPENSE", "1450.00", "housing", 2], ["Netflix", "EXPENSE", "15.49", "entertainment", 5], ["Gym membership", "EXPENSE", "45.00", "personal", 8],
  ] as const) {
    const base = firstOfMonth(6).slice(0, 8) + String(day).padStart(2, "0");
    await createRule(userId, { accountId: everyday.id, type, amount, category, description, interval: "MONTHLY", startDate: base });
  }

  const rand = rng(42);
  const thisMonth = today.getUTCMonth();
  for (let d = 0; d <= 183; d++) {
    const date = addDays(start, d);
    const sameMonth = date.getUTCMonth() === thisMonth && date.getUTCFullYear() === today.getUTCFullYear();
    const n = rand() < 0.55 ? 1 : rand() < 0.3 ? 2 : 0;
    for (let i = 0; i < n; i++) {
      let r = rand() * SPEND.reduce((a, s) => a + s.weight, 0);
      const pick = SPEND.find((s) => (r -= s.weight) <= 0) ?? (SPEND[0] as (typeof SPEND)[number]);
      const merchant = pick.merchants[Math.floor(rand() * pick.merchants.length)] as string;
      // The current month runs hot on food so the dashboard has something real to flag.
      const boost = sameMonth && pick.category === "food" ? 2.6 : 1;
      const amount = ((pick.min + rand() * (pick.max - pick.min)) * boost).toFixed(2);
      await createTransaction(userId, { accountId: rand() < 0.35 ? card.id : everyday.id, type: "EXPENSE", amount, date: formatDateOnly(date), category: pick.category, merchant, description: merchant });
    }
  }
  for (let m = 5; m >= 0; m--) {
    const date = firstOfMonth(m).slice(0, 8) + "03";
    if (date <= formatDateOnly(today)) await createTransfer(userId, { fromAccountId: everyday.id, toAccountId: savings.id, amount: "500.00", date, note: "Monthly savings" });
  }
  await createTransaction(userId, { accountId: everyday.id, type: "EXPENSE", amount: "62.00", date: startStr(180), category: "other-expense", description: "Quuxcorp Ltd" });

  await setBudget(userId, "all", "3200");
  await setBudget(userId, "food", "450");
  await setBudget(userId, "groceries", "600");
  await setBudget(userId, "entertainment", "120");

  const fund = await createGoal(userId, { name: "Emergency fund", targetAmount: "15000.00" });
  await contributeToGoal(userId, fund.id, { kind: "deposit", amount: "6200.00", date: formatDateOnly(addDays(today, -30)) });
  await createGoal(userId, { name: "Summer trip", targetAmount: "3000.00", deadline: formatDateOnly(addDays(today, 180)) });

  const count = await db.transaction.count({ where: { userId } });
  console.log(`Seeded ${EMAIL} (password: demo-password-123) with ${count} transactions.`);
}

main().then(() => db.$disconnect()).catch(async (e) => { console.error(e); await db.$disconnect(); process.exit(1); });
