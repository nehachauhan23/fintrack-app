import { diffDays } from "./periods";
import { mad, mean, median, stddev } from "./stats";
import { occurrenceAt } from "./recurrence";

export interface TxnLite {
  id: string;
  accountId: string;
  category: string;
  amount: number;
  date: Date;
  /** Normalised merchant/description key (see normalizeMerchant). */
  merchantKey: string;
}

export interface CategorySpike {
  category: string;
  /** Spent so far this month. */
  spent: number;
  /** The mean of what the same categories had reached by the same day in earlier months. */
  baseline: number;
  zScore: number;
  ratio: number;
}

/**
 * Flags categories where this month's spend so far is far above where earlier months were *by the same day*.
 * Both sides are month-to-date, so fixed bills (rent posts on the 2nd every month) and lumpy categories are compared
 * like with like, with no linear extrapolation that would turn one payment into a false "on pace for" alarm.
 * `minExcess` is an absolute floor, so small categories can't trigger alerts over trivial amounts.
 */
export function detectCategorySpikes(
  historyToDate: Record<string, number[]>,
  spentSoFar: Record<string, number>,
  opts: { minMonths?: number; minZ?: number; minRatio?: number; minExcess?: number } = {},
): CategorySpike[] {
  const { minMonths = 3, minZ = 2, minRatio = 1.5, minExcess = 0 } = opts;
  const out: CategorySpike[] = [];
  for (const [category, spent] of Object.entries(spentSoFar)) {
    const past = historyToDate[category] ?? [];
    if (past.length < minMonths) continue;
    const baseline = mean(past);
    if (baseline <= 0) continue;
    const sd = Math.max(stddev(past), baseline * 0.15);
    const zScore = (spent - baseline) / sd;
    const ratio = spent / baseline;
    if (zScore >= minZ && ratio >= minRatio && spent - baseline >= minExcess) out.push({ category, spent, baseline, zScore, ratio });
  }
  return out.sort((a, b) => b.zScore - a.zScore);
}

export interface Outlier {
  id: string;
  category: string;
  amount: number;
  typical: number;
}

/** Individual expenses that are unusually large for their category (median + MAD, robust to the outliers themselves). */
export function detectOutliers(txns: TxnLite[], opts: { minCount?: number; minAmount?: number } = {}): Outlier[] {
  const { minCount = 5, minAmount = 0 } = opts;
  const byCategory = new Map<string, TxnLite[]>();
  for (const t of txns) byCategory.set(t.category, [...(byCategory.get(t.category) ?? []), t]);
  const out: Outlier[] = [];
  for (const [category, list] of byCategory) {
    if (list.length < minCount) continue;
    const amounts = list.map((t) => t.amount);
    const med = median(amounts);
    const threshold = med + 5 * Math.max(mad(amounts), med * 0.1);
    for (const t of list) {
      if (t.amount > threshold && t.amount > 2 * med && t.amount >= minAmount) {
        out.push({ id: t.id, category, amount: t.amount, typical: med });
      }
    }
  }
  return out.sort((a, b) => b.amount / b.typical - a.amount / a.typical);
}

export interface DuplicatePair {
  first: string;
  second: string;
  amount: number;
  merchantKey: string;
}

/** Same merchant + same amount + same account within a few days: usually a double charge. */
export function detectDuplicates(txns: TxnLite[], windowDays = 3): DuplicatePair[] {
  const groups = new Map<string, TxnLite[]>();
  for (const t of txns) {
    if (!t.merchantKey) continue;
    const key = `${t.accountId}|${t.merchantKey}|${t.amount.toFixed(2)}`;
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }
  const out: DuplicatePair[] = [];
  for (const list of groups.values()) {
    const sorted = [...list].sort((a, b) => a.date.getTime() - b.date.getTime());
    for (let i = 1; i < sorted.length; i++) {
      const a = sorted[i - 1] as TxnLite;
      const b = sorted[i] as TxnLite;
      if (diffDays(b.date, a.date) <= windowDays) {
        out.push({ first: a.id, second: b.id, amount: b.amount, merchantKey: b.merchantKey });
      }
    }
  }
  return out;
}

export interface SubscriptionCandidate {
  merchantKey: string;
  category: string;
  amount: number;
  interval: "WEEKLY" | "MONTHLY" | "YEARLY";
  occurrences: number;
  lastDate: Date;
  nextExpected: Date;
}

const CADENCES = [
  { interval: "WEEKLY", gap: 7, tolerance: 1, min: 4 },
  { interval: "MONTHLY", gap: 30.4, tolerance: 4, min: 3 },
  { interval: "YEARLY", gap: 365, tolerance: 10, min: 2 },
] as const;

/** Finds charges that repeat at a regular cadence with a stable amount: likely subscriptions or standing orders. */
export function detectSubscriptions(txns: TxnLite[]): SubscriptionCandidate[] {
  const byMerchant = new Map<string, TxnLite[]>();
  for (const t of txns) {
    if (!t.merchantKey) continue;
    byMerchant.set(t.merchantKey, [...(byMerchant.get(t.merchantKey) ?? []), t]);
  }
  const out: SubscriptionCandidate[] = [];
  for (const [merchantKey, list] of byMerchant) {
    const typical = median(list.map((t) => t.amount));
    const stable = list
      .filter((t) => Math.abs(t.amount - typical) <= typical * 0.05)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
    if (stable.length < 2) continue;
    const gaps = stable.slice(1).map((t, i) => diffDays(t.date, (stable[i] as TxnLite).date));
    const gap = median(gaps);
    const cadence = CADENCES.find((c) => Math.abs(gap - c.gap) <= c.tolerance && stable.length >= c.min);
    if (!cadence) continue;
    if (!gaps.every((g) => Math.abs(g - gap) <= cadence.tolerance + 2)) continue;
    const last = stable[stable.length - 1] as TxnLite;
    const nextExpected =
      cadence.interval === "WEEKLY"
        ? new Date(last.date.getTime() + 7 * 86_400_000)
        : occurrenceAt(last.date, cadence.interval, 1);
    out.push({
      merchantKey,
      category: last.category,
      amount: typical,
      interval: cadence.interval,
      occurrences: stable.length,
      lastDate: last.date,
      nextExpected,
    });
  }
  return out.sort((a, b) => b.amount - a.amount);
}
