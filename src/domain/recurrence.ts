import { addDays } from "./periods";

export type Interval = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

const DAY_MS = 86_400_000;

function daysIn(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/**
 * The n-th occurrence counted from the anchor (n = 0 is the anchor itself).
 * Monthly/yearly occurrences always derive from the anchor day, so Jan 31 → Feb 28 → Mar 31 (no drift).
 */
export function occurrenceAt(anchor: Date, interval: Interval, n: number): Date {
  switch (interval) {
    case "DAILY":
      return addDays(anchor, n);
    case "WEEKLY":
      return addDays(anchor, 7 * n);
    case "MONTHLY":
    case "YEARLY": {
      const months = interval === "MONTHLY" ? n : n * 12;
      const total = anchor.getUTCFullYear() * 12 + anchor.getUTCMonth() + months;
      const year = Math.floor(total / 12);
      const month = total - year * 12;
      const day = Math.min(anchor.getUTCDate(), daysIn(year, month));
      return new Date(Date.UTC(year, month, day));
    }
  }
}

function monthsBetween(a: Date, b: Date): number {
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
}

function firstIndexOnOrAfter(anchor: Date, interval: Interval, date: Date): number {
  if (date.getTime() <= anchor.getTime()) return 0;
  let n: number;
  switch (interval) {
    case "DAILY":
      n = Math.floor((date.getTime() - anchor.getTime()) / DAY_MS);
      break;
    case "WEEKLY":
      n = Math.floor((date.getTime() - anchor.getTime()) / (7 * DAY_MS));
      break;
    case "MONTHLY":
      n = Math.max(0, monthsBetween(anchor, date) - 1);
      break;
    case "YEARLY":
      n = Math.max(0, Math.floor(monthsBetween(anchor, date) / 12) - 1);
      break;
  }
  while (occurrenceAt(anchor, interval, n).getTime() < date.getTime()) n++;
  return n;
}

/** The first occurrence strictly after `after`. */
export function nextAfter(anchor: Date, interval: Interval, after: Date): Date {
  const n = firstIndexOnOrAfter(anchor, interval, addDays(after, 1));
  return occurrenceAt(anchor, interval, n);
}

/**
 * Occurrences in [from, to], optionally capped by endDate. `limit` bounds catch-up work after long outages
 * so a stale rule can never generate an unbounded number of rows in one run.
 */
export function occurrencesBetween(
  anchor: Date,
  interval: Interval,
  from: Date,
  to: Date,
  opts: { endDate?: Date | null; limit?: number } = {},
): Date[] {
  const limit = opts.limit ?? 366;
  const out: Date[] = [];
  let n = firstIndexOnOrAfter(anchor, interval, from);
  while (out.length < limit) {
    const d = occurrenceAt(anchor, interval, n++);
    if (d.getTime() > to.getTime()) break;
    if (opts.endDate && d.getTime() > opts.endDate.getTime()) break;
    out.push(d);
  }
  return out;
}
