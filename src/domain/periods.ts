/** Calendar helpers. Everything is UTC and date-only: a transaction date has no time zone. */
export type PeriodKey = string; // "YYYY-MM"

const DAY_MS = 86_400_000;

export function periodKeyOf(d: Date): PeriodKey {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function parsePeriodKey(key: PeriodKey): { year: number; month: number } | null {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(key);
  return m ? { year: Number(m[1]), month: Number(m[2]) } : null;
}

export function monthBounds(key: PeriodKey): { start: Date; endExclusive: Date } {
  const p = parsePeriodKey(key);
  if (!p) throw new Error(`Invalid period key: ${key}`);
  return {
    start: new Date(Date.UTC(p.year, p.month - 1, 1)),
    endExclusive: new Date(Date.UTC(p.year, p.month, 1)),
  };
}

export function addMonths(key: PeriodKey, n: number): PeriodKey {
  const { start } = monthBounds(key);
  return periodKeyOf(new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + n, 1)));
}

/** Oldest first, ending at `endKey` (inclusive). */
export function lastPeriods(count: number, endKey: PeriodKey): PeriodKey[] {
  return Array.from({ length: count }, (_, i) => addMonths(endKey, i - (count - 1)));
}

export function daysInMonth(key: PeriodKey): number {
  const { start, endExclusive } = monthBounds(key);
  return Math.round((endExclusive.getTime() - start.getTime()) / DAY_MS);
}

export function utcToday(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function formatDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Strict YYYY-MM-DD → UTC midnight. Rejects impossible dates such as 2026-02-31. */
export function parseDateOnly(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return formatDateOnly(d) === s ? d : null;
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY_MS);
}

export function diffDays(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / DAY_MS);
}
