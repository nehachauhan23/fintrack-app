import "server-only";
import { db } from "@/server/db";
import { categoryName } from "@/domain/categories";
import { balanceSeries, runningBalances, type BalancePoint } from "@/domain/balance";
import { projectMonthEnd, savingsRate } from "@/domain/budget";
import { detectCategorySpikes, detectDuplicates, detectOutliers, type TxnLite } from "@/domain/anomaly";
import { normalizeMerchant } from "@/domain/merchant";
import { addDays, addMonths, daysInMonth, formatDateOnly, lastPeriods, monthBounds, periodKeyOf, utcToday, type PeriodKey } from "@/domain/periods";
import { getOwnedAccount } from "./accounts";

const num = (v: unknown): number => (v === null || v === undefined ? 0 : Number(String(v)));
const SPEND_TYPES = ["INCOME", "EXPENSE"] as const;

export interface MonthSummary {
  period: PeriodKey;
  income: number;
  expense: number;
  net: number;
  savingsRate: number | null;
}

export async function monthSummary(userId: string, period: PeriodKey): Promise<MonthSummary> {
  const { start, endExclusive } = monthBounds(period);
  const rows = await db.transaction.groupBy({
    by: ["type"],
    where: { userId, type: { in: [...SPEND_TYPES] }, date: { gte: start, lt: endExclusive } },
    _sum: { amount: true },
  });
  const income = rows.find((r) => r.type === "INCOME")?._sum.amount?.toNumber() ?? 0;
  const expense = rows.find((r) => r.type === "EXPENSE")?._sum.amount?.toNumber() ?? 0;
  return { period, income, expense, net: income - expense, savingsRate: savingsRate(income, expense) };
}

export interface CashFlowPoint {
  period: PeriodKey;
  income: number;
  expense: number;
}

export async function cashFlow(userId: string, endPeriod: PeriodKey, months = 6): Promise<CashFlowPoint[]> {
  const periods = lastPeriods(months, endPeriod);
  const from = monthBounds(periods[0] as PeriodKey).start;
  const to = monthBounds(endPeriod).endExclusive;
  const rows = await db.$queryRaw<{ period: string; type: string; total: unknown }[]>`
    SELECT to_char(date_trunc('month', "date"), 'YYYY-MM') AS period, "type"::text AS type, SUM("amount") AS total
    FROM transactions
    WHERE "userId" = ${userId} AND "date" >= ${formatDateOnly(from)}::date AND "date" < ${formatDateOnly(to)}::date
      AND "type" IN ('INCOME'::"TransactionType", 'EXPENSE'::"TransactionType")
    GROUP BY 1, 2`;
  return periods.map((period) => ({
    period,
    income: num(rows.find((r) => r.period === period && r.type === "INCOME")?.total),
    expense: num(rows.find((r) => r.period === period && r.type === "EXPENSE")?.total),
  }));
}

export interface CategoryTotal {
  category: string;
  name: string;
  amount: number;
  count: number;
  pct: number;
}

export async function categoryBreakdown(userId: string, range: { from: Date; toExclusive: Date }, type: "INCOME" | "EXPENSE" = "EXPENSE"): Promise<CategoryTotal[]> {
  const rows = await db.transaction.groupBy({
    by: ["category"],
    where: { userId, type, date: { gte: range.from, lt: range.toExclusive } },
    _sum: { amount: true },
    _count: { _all: true },
  });
  const total = rows.reduce((a, r) => a + (r._sum.amount?.toNumber() ?? 0), 0);
  return rows
    .map((r) => {
      const amount = r._sum.amount?.toNumber() ?? 0;
      return { category: r.category, name: categoryName(r.category), amount, count: r._count._all, pct: total > 0 ? (amount / total) * 100 : 0 };
    })
    .sort((a, b) => b.amount - a.amount);
}

export interface MerchantTotal {
  name: string;
  amount: number;
  count: number;
}

export async function topMerchants(userId: string, range: { from: Date; toExclusive: Date }, limit = 6): Promise<MerchantTotal[]> {
  const rows = await db.$queryRaw<{ name: string; total: unknown; count: bigint }[]>`
    SELECT COALESCE(NULLIF(TRIM("merchant"), ''), NULLIF(TRIM("description"), '')) AS name, SUM("amount") AS total, COUNT(*) AS count
    FROM transactions
    WHERE "userId" = ${userId} AND "type" = 'EXPENSE'::"TransactionType"
      AND "date" >= ${formatDateOnly(range.from)}::date AND "date" < ${formatDateOnly(range.toExclusive)}::date
      AND COALESCE(NULLIF(TRIM("merchant"), ''), NULLIF(TRIM("description"), '')) IS NOT NULL
    GROUP BY 1 ORDER BY SUM("amount") DESC LIMIT ${limit}`;
  return rows.map((r) => ({ name: r.name, amount: num(r.total), count: Number(r.count) }));
}

/**
 * Monthly expense totals per category, aligned to `periods` (zeros included).
 * With `throughDay`, each month only counts spending up to that day of the month (month-to-date history).
 */
export async function monthlyCategorySpend(userId: string, periods: PeriodKey[], throughDay = 31): Promise<Record<string, number[]>> {
  if (periods.length === 0) return {};
  const from = monthBounds(periods[0] as PeriodKey).start;
  const to = monthBounds(periods[periods.length - 1] as PeriodKey).endExclusive;
  const rows = await db.$queryRaw<{ period: string; category: string; total: unknown }[]>`
    SELECT to_char(date_trunc('month', "date"), 'YYYY-MM') AS period, "category", SUM("amount") AS total
    FROM transactions
    WHERE "userId" = ${userId} AND "type" = 'EXPENSE'::"TransactionType"
      AND "date" >= ${formatDateOnly(from)}::date AND "date" < ${formatDateOnly(to)}::date
      AND EXTRACT(DAY FROM "date") <= ${throughDay}
    GROUP BY 1, 2`;
  const out: Record<string, number[]> = {};
  for (const r of rows) {
    const idx = periods.indexOf(r.period);
    if (idx < 0) continue;
    (out[r.category] ??= periods.map(() => 0))[idx] = num(r.total);
  }
  return out;
}

export interface AnomalyReport {
  spikes: { category: string; name: string; spent: number; baseline: number; ratio: number }[];
  outliers: { id: string; label: string; amount: number; typical: number; date: string; category: string }[];
  duplicates: { firstId: string; secondId: string; label: string; amount: number; date: string }[];
}

export async function detectAnomalies(userId: string, now = new Date()): Promise<AnomalyReport> {
  const today = utcToday(now);
  const period = periodKeyOf(today);
  const day = today.getUTCDate();
  const historyPeriods = lastPeriods(6, addMonths(period, -1));
  const [history, current] = await Promise.all([
    monthlyCategorySpend(userId, historyPeriods, day),
    categoryBreakdown(userId, { from: monthBounds(period).start, toExclusive: monthBounds(period).endExclusive }),
  ]);
  // Scale-aware floor: an alert should be about at least 5% of a typical month's total spending (never under 20).
  const monthTotals = historyPeriods.map((_, i) => Object.values(history).reduce((sum, series) => sum + (series[i] ?? 0), 0));
  const minExcess = Math.max(20, 0.05 * (monthTotals.reduce((a, b) => a + b, 0) / Math.max(1, monthTotals.length)));
  // The first days of a month say very little; wait for a meaningful sample.
  const spikes = (day < 5 ? [] : detectCategorySpikes(history, Object.fromEntries(current.map((c) => [c.category, c.amount])), { minExcess })).map((s) => ({
    category: s.category,
    name: categoryName(s.category),
    spent: s.spent,
    baseline: s.baseline,
    ratio: s.ratio,
  }));

  const since = addDays(today, -90);
  const rows = await db.transaction.findMany({
    where: { userId, type: "EXPENSE", date: { gte: since } },
    orderBy: { date: "desc" },
    take: 1500,
  });
  const label = (r: { merchant: string | null; description: string | null; category: string }) => r.merchant || r.description || categoryName(r.category);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const lite: TxnLite[] = rows.map((r) => ({
    id: r.id, accountId: r.accountId, category: r.category, amount: r.amount.toNumber(), date: r.date, merchantKey: normalizeMerchant(r.merchant || r.description || ""),
  }));
  const recentCutoff = addDays(today, -30);
  const outliers = detectOutliers(lite, { minAmount: 20 })
    .filter((o) => (byId.get(o.id)?.date ?? since) >= recentCutoff)
    .slice(0, 5)
    .map((o) => {
      const r = byId.get(o.id)!;
      return { id: o.id, label: label(r), amount: o.amount, typical: o.typical, date: formatDateOnly(r.date), category: r.category };
    });
  const duplicates = detectDuplicates(lite.filter((t) => t.date >= addDays(today, -14)))
    .slice(0, 5)
    .map((p) => {
      const r = byId.get(p.second)!;
      return { firstId: p.first, secondId: p.second, label: label(r), amount: p.amount, date: formatDateOnly(r.date) };
    });
  return { spikes, outliers, duplicates };
}

export async function balanceHistory(userId: string, accountId: string, days = 60, now = new Date()): Promise<BalancePoint[]> {
  const acc = await getOwnedAccount(userId, accountId, { allowArchived: true });
  const to = utcToday(now);
  const from = addDays(to, -(days - 1));
  const rows = await db.transaction.findMany({ where: { accountId, userId, date: { gte: from } }, select: { date: true, type: true, amount: true } });
  const deltas = rows.map((r) => ({
    date: formatDateOnly(r.date),
    delta: (r.type === "INCOME" || r.type === "TRANSFER_IN" ? 1 : -1) * r.amount.toNumber(),
  }));
  return balanceSeries(acc.balance.toNumber(), deltas, formatDateOnly(from), formatDateOnly(to));
}

export interface PeriodStats {
  period: PeriodKey;
  income: number;
  expense: number;
  net: number;
  savingsRate: number | null;
  previous: { income: number; expense: number } | null;
  categories: { name: string; amount: number; pctOfExpense: number; changeVsPrevious: number | null }[];
}

/** Aggregates only (no descriptions, no merchants): this is the sole financial data that is ever sent to the AI provider. */
export async function periodStats(userId: string, period: PeriodKey): Promise<PeriodStats> {
  const prevKey = addMonths(period, -1);
  const [cur, prev, curCats, prevCats] = await Promise.all([
    monthSummary(userId, period),
    monthSummary(userId, prevKey),
    categoryBreakdown(userId, { from: monthBounds(period).start, toExclusive: monthBounds(period).endExclusive }),
    categoryBreakdown(userId, { from: monthBounds(prevKey).start, toExclusive: monthBounds(prevKey).endExclusive }),
  ]);
  const prevByCat = new Map(prevCats.map((c) => [c.category, c.amount]));
  const hasPrev = prev.income > 0 || prev.expense > 0;
  return {
    period,
    income: cur.income,
    expense: cur.expense,
    net: cur.net,
    savingsRate: cur.savingsRate,
    previous: hasPrev ? { income: prev.income, expense: prev.expense } : null,
    categories: curCats.slice(0, 8).map((c) => {
      const before = prevByCat.get(c.category);
      return { name: c.name, amount: c.amount, pctOfExpense: c.pct, changeVsPrevious: before && before > 0 ? ((c.amount - before) / before) * 100 : null };
    }),
  };
}

/** Month-end outlook used on the dashboard. */
export function outlook(summary: MonthSummary, now = new Date()) {
  const today = utcToday(now);
  const period = periodKeyOf(today);
  const projectedExpense = summary.period === period ? projectMonthEnd(summary.expense, today.getUTCDate(), daysInMonth(period)) : summary.expense;
  return { projectedExpense, dayOfMonth: today.getUTCDate(), daysInMonth: daysInMonth(period) };
}

export interface LedgerRow {
  id: string;
  date: string;
  description: string;
  category: string;
  type: "INCOME" | "EXPENSE" | "TRANSFER_IN" | "TRANSFER_OUT";
  amount: number;
  signed: number;
  balance: number;
  aiCategorized: boolean;
}

/** The latest entries of one account with the running balance after each: the "ledger" view. */
export async function accountLedger(userId: string, accountId: string, limit = 60): Promise<LedgerRow[]> {
  const acc = await getOwnedAccount(userId, accountId, { allowArchived: true });
  const rows = await db.transaction.findMany({ where: { userId, accountId }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: limit });
  const deltas = rows.map((r) => (r.type === "INCOME" || r.type === "TRANSFER_IN" ? 1 : -1) * r.amount.toNumber());
  const balances = runningBalances(acc.balance.toNumber(), deltas);
  return rows.map((r, i) => ({
    id: r.id,
    date: formatDateOnly(r.date),
    description: r.merchant || r.description || categoryName(r.category),
    category: r.category,
    type: r.type,
    amount: r.amount.toNumber(),
    signed: deltas[i] as number,
    balance: balances[i] as number,
    aiCategorized: r.aiCategorized,
  }));
}
