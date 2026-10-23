export interface BudgetProgress {
  spent: number;
  limit: number;
  pct: number;
  remaining: number;
  /** 0 = fine, 80 = warning, 100 = exceeded. */
  level: 0 | 80 | 100;
}

export function budgetProgress(spent: number, limit: number): BudgetProgress {
  const pct = limit > 0 ? (spent / limit) * 100 : 0;
  const level = pct >= 100 ? 100 : pct >= 80 ? 80 : 0;
  return { spent, limit, pct, remaining: limit - spent, level };
}

/**
 * Linear month-end projection. Returns the spend so far for the first days of a month, where one big
 * early purchase would otherwise produce an absurd projection.
 */
export function projectMonthEnd(spentSoFar: number, dayOfMonth: number, daysInMonth: number): number {
  if (dayOfMonth < 4) return spentSoFar;
  return (spentSoFar / dayOfMonth) * daysInMonth;
}

/** How much can still be spent per remaining day (today included) without breaking the budget. */
export function dailyAllowance(limit: number, spent: number, dayOfMonth: number, daysInMonth: number): number {
  const daysLeft = Math.max(1, daysInMonth - dayOfMonth + 1);
  return Math.max(0, (limit - spent) / daysLeft);
}

export function savingsRate(income: number, expense: number): number | null {
  return income > 0 ? ((income - expense) / income) * 100 : null;
}

/** Suggests a monthly limit from past spend: the mean of recent months plus a 10% buffer, rounded up to a clean figure. */
export function suggestLimit(monthlySpend: number[]): number | null {
  const nonZero = monthlySpend.filter((v) => v > 0);
  if (nonZero.length === 0) return null;
  const mean = nonZero.reduce((a, b) => a + b, 0) / nonZero.length;
  const raw = mean * 1.1;
  const step = raw >= 10_000 ? 500 : raw >= 1_000 ? 50 : raw >= 100 ? 10 : 5;
  return Math.ceil(raw / step) * step;
}
