import "server-only";
import { Prisma, db } from "@/server/db";
import { invalid } from "@/lib/errors";
import { OVERALL_BUDGET, categoryName, getCategory } from "@/domain/categories";
import { budgetProgress } from "@/domain/budget";
import { parseMoneyInput } from "@/domain/money";
import { monthBounds, periodKeyOf, type PeriodKey } from "@/domain/periods";

const D = Prisma.Decimal;

export interface BudgetStatus {
  id: string;
  category: string;
  name: string;
  limit: number;
  spent: number;
  pct: number;
  remaining: number;
  level: 0 | 80 | 100;
}

async function spentByCategory(userId: string, period: PeriodKey): Promise<{ total: number; byCategory: Map<string, number> }> {
  const { start, endExclusive } = monthBounds(period);
  const rows = await db.transaction.groupBy({
    by: ["category"],
    where: { userId, type: "EXPENSE", date: { gte: start, lt: endExclusive } },
    _sum: { amount: true },
  });
  const byCategory = new Map(rows.map((r) => [r.category, r._sum.amount?.toNumber() ?? 0]));
  return { total: [...byCategory.values()].reduce((a, b) => a + b, 0), byCategory };
}

export async function budgetStatuses(userId: string, period: PeriodKey): Promise<BudgetStatus[]> {
  const [budgets, spent] = await Promise.all([db.budget.findMany({ where: { userId } }), spentByCategory(userId, period)]);
  return budgets
    .map((b) => {
      const limit = b.amount.toNumber();
      const s = b.category === OVERALL_BUDGET ? spent.total : (spent.byCategory.get(b.category) ?? 0);
      return { id: b.id, category: b.category, name: categoryName(b.category), ...budgetProgress(s, limit) };
    })
    .sort((a, b) => (a.category === OVERALL_BUDGET ? -1 : b.category === OVERALL_BUDGET ? 1 : b.pct - a.pct));
}

export async function setBudget(userId: string, category: string, amount: string): Promise<void> {
  const canonical = parseMoneyInput(amount);
  if (!canonical) throw invalid("Enter a budget greater than zero.", { amount: ["Enter a valid amount"] });
  if (category !== OVERALL_BUDGET && getCategory(category)?.kind !== "EXPENSE") throw invalid("Budgets can only be set for expense categories.", { category: ["Pick an expense category"] });
  await db.budget.upsert({
    where: { userId_category: { userId, category } },
    // A new limit restarts alerting for the current month.
    create: { userId, category, amount: new D(canonical) },
    update: { amount: new D(canonical), alertedPeriod: null, alertedLevel: 0 },
  });
}

export async function removeBudget(userId: string, category: string): Promise<void> {
  await db.budget.deleteMany({ where: { userId, category } });
}

export interface BudgetAlert {
  budgetId: string;
  userId: string;
  email: string;
  name: string;
  currency: string;
  category: string;
  categoryName: string;
  limit: number;
  spent: number;
  level: 80 | 100;
  period: PeriodKey;
}

/**
 * Finds budgets that crossed 80% or 100% this month and have not been alerted at that level yet.
 * Nothing is marked as sent here: call markBudgetAlerted after the email actually went out, so a failed send is retried.
 */
export async function collectBudgetAlerts(now = new Date()): Promise<BudgetAlert[]> {
  const period = periodKeyOf(now);
  const users = await db.user.findMany({ where: { emailAlerts: true, budgets: { some: {} } }, select: { id: true, email: true, name: true, currency: true } });
  const alerts: BudgetAlert[] = [];
  for (const user of users) {
    const [budgets, spent] = await Promise.all([db.budget.findMany({ where: { userId: user.id } }), spentByCategory(user.id, period)]);
    for (const b of budgets) {
      const s = b.category === OVERALL_BUDGET ? spent.total : (spent.byCategory.get(b.category) ?? 0);
      const p = budgetProgress(s, b.amount.toNumber());
      if (p.level === 0) continue;
      const already = b.alertedPeriod === period ? b.alertedLevel : 0;
      if (p.level > already) {
        alerts.push({ budgetId: b.id, userId: user.id, email: user.email, name: user.name, currency: user.currency, category: b.category, categoryName: categoryName(b.category), limit: p.limit, spent: s, level: p.level, period });
      }
    }
  }
  return alerts;
}

export async function markBudgetAlerted(budgetId: string, period: PeriodKey, level: 80 | 100): Promise<void> {
  await db.budget.update({ where: { id: budgetId }, data: { alertedPeriod: period, alertedLevel: level } });
}
