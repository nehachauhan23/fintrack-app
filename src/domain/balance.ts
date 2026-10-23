import { addDays, formatDateOnly, parseDateOnly } from "./periods";

export interface BalanceTxn {
  /** YYYY-MM-DD */
  date: string;
  /** Signed effect on the balance. */
  delta: number;
}

export interface BalancePoint {
  date: string;
  balance: number;
}

/**
 * End-of-day balances for [from, to], reconstructed backwards from the current balance.
 * balance(d) = current − Σ delta(date > d), so it stays correct even with future-dated entries.
 */
export function balanceSeries(currentBalance: number, txns: BalanceTxn[], from: string, to: string): BalancePoint[] {
  const start = parseDateOnly(from);
  const end = parseDateOnly(to);
  if (!start || !end || start > end) return [];
  const byDay = new Map<string, number>();
  let after = 0;
  for (const t of txns) {
    if (t.date > to) after += t.delta;
    else byDay.set(t.date, (byDay.get(t.date) ?? 0) + t.delta);
  }
  let running = currentBalance - after;
  const out: BalancePoint[] = [];
  for (let d = end; d >= start; d = addDays(d, -1)) {
    const key = formatDateOnly(d);
    out.push({ date: key, balance: Math.round(running * 100) / 100 });
    running -= byDay.get(key) ?? 0;
  }
  return out.reverse();
}

/**
 * Balance after each entry, for rows ordered newest first. The newest row's balance equals the account's current balance;
 * each older row is the one above it with that row's own effect undone.
 */
export function runningBalances(currentBalance: number, deltasNewestFirst: number[]): number[] {
  const out: number[] = [];
  let balance = currentBalance;
  for (const delta of deltasNewestFirst) {
    out.push(Math.round(balance * 100) / 100);
    balance -= delta;
  }
  return out;
}
