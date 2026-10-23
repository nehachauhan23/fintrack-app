import { createHash } from "node:crypto";
import { formatDateOnly, parseDateOnly } from "./periods";
import { parseMoneyInput } from "./money";

export type DateOrder = "dmy" | "mdy";

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

function build(year: number, month: number, day: number): Date | null {
  const y = year < 100 ? 2000 + year : year;
  const pad = (n: number) => String(n).padStart(2, "0");
  return parseDateOnly(`${String(y).padStart(4, "0")}-${pad(month)}-${pad(day)}`);
}

export function parseDateCell(raw: string, order: DateOrder): Date | null {
  const s = raw.trim();
  if (!s) return null;
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s].*)?$/.exec(s);
  if (m) return build(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/.exec(s);
  if (m) {
    const [a, b, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
    return order === "dmy" ? build(y, b, a) : build(y, a, b);
  }
  m = /^(\d{1,2})[\s-]([A-Za-z]{3,9})[\s,-]*(\d{2,4})$/.exec(s);
  if (m) {
    const mon = MONTHS[(m[2] as string).slice(0, 4).toLowerCase()] ?? MONTHS[(m[2] as string).slice(0, 3).toLowerCase()];
    return mon ? build(Number(m[3]), mon, Number(m[1])) : null;
  }
  m = /^([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})$/.exec(s);
  if (m) {
    const mon = MONTHS[(m[1] as string).slice(0, 4).toLowerCase()] ?? MONTHS[(m[1] as string).slice(0, 3).toLowerCase()];
    return mon ? build(Number(m[3]), mon, Number(m[2])) : null;
  }
  return null;
}

/** Parses "1,234.50", "(45.00)", "-45", "45 DR", "₹1.234,50" into a signed number; null when it is not an amount. */
export function parseAmountCell(raw: string): number | null {
  let s = raw.trim();
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (/\bdr\b\.?$/i.test(s)) negative = true;
  s = s.replace(/\b(dr|cr)\b\.?$/i, "").replace(/[^\d.,-]/g, "");
  if (s.startsWith("-")) {
    negative = !negative;
    s = s.slice(1);
  }
  if (s.endsWith("-")) {
    negative = !negative;
    s = s.slice(0, -1);
  }
  if (!s) return null;
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  if (lastDot >= 0 && lastComma >= 0) {
    // The later separator is the decimal mark.
    s = lastDot > lastComma ? s.replace(/,/g, "") : s.replace(/\./g, "").replace(",", ".");
  } else if (lastComma >= 0) {
    s = /,\d{2}$/.test(s) ? s.replace(",", ".") : s.replace(/,/g, "");
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

export interface ColumnMapping {
  date: string;
  description: string;
  amount?: string;
  debit?: string;
  credit?: string;
}

export function detectColumns(headers: string[]): Partial<ColumnMapping> {
  const find = (re: RegExp) => headers.find((h) => re.test(h.trim().toLowerCase()));
  return {
    date: find(/^(transaction\s*)?date|^posted|^value date|^txn date/),
    description: find(/descr|narration|details|memo|payee|merchant|particulars|reference|name/),
    amount: find(/^amount|^value$|^transaction amount/),
    debit: find(/debit|withdraw|paid out|money out/),
    credit: find(/credit|deposit|paid in|money in/),
  };
}

export interface ParsedRow {
  line: number;
  date: string;
  type: "INCOME" | "EXPENSE";
  amount: string;
  description: string;
}

export interface RowError {
  line: number;
  message: string;
}

export function mapRows(
  rows: Record<string, string>[],
  mapping: ColumnMapping,
  opts: { dateOrder: DateOrder; invertSign?: boolean },
): { rows: ParsedRow[]; errors: RowError[] } {
  const out: ParsedRow[] = [];
  const errors: RowError[] = [];
  rows.forEach((row, i) => {
    const line = i + 2; // header is line 1
    const dateCell = row[mapping.date] ?? "";
    const date = parseDateCell(dateCell, opts.dateOrder);
    if (!date) {
      errors.push({ line, message: `Unrecognised date "${dateCell}"` });
      return;
    }
    let signed: number | null = null;
    if (mapping.amount) {
      signed = parseAmountCell(row[mapping.amount] ?? "");
      if (signed !== null && opts.invertSign) signed = -signed;
    } else {
      const debit = parseAmountCell(row[mapping.debit ?? ""] ?? "");
      const credit = parseAmountCell(row[mapping.credit ?? ""] ?? "");
      if (debit && Math.abs(debit) > 0) signed = -Math.abs(debit);
      else if (credit && Math.abs(credit) > 0) signed = Math.abs(credit);
    }
    if (signed === null || signed === 0) {
      errors.push({ line, message: "Missing or zero amount" });
      return;
    }
    const amount = parseMoneyInput(Math.abs(signed).toFixed(2));
    if (!amount) {
      errors.push({ line, message: "Amount out of range" });
      return;
    }
    out.push({
      line,
      date: formatDateOnly(date),
      type: signed < 0 ? "EXPENSE" : "INCOME",
      amount,
      description: (row[mapping.description] ?? "").trim().slice(0, 200),
    });
  });
  return { rows: out, errors };
}

/**
 * Stable dedupe key. `occurrence` distinguishes genuinely identical rows within one file
 * (two coffees, same day, same price) while still making a re-import of the same file a no-op.
 */
export function importHash(accountId: string, row: Pick<ParsedRow, "date" | "amount" | "type" | "description">, occurrence: number): string {
  return createHash("sha256")
    .update([accountId, row.date, row.type, row.amount, row.description.toLowerCase().trim(), occurrence].join("|"))
    .digest("hex")
    .slice(0, 40);
}

/** Coerces whatever a model or a form hands us (12, "12.5", "$1,200") into a canonical positive amount string, or null. */
export function coerceAmount(value: unknown): string | null {
  if (typeof value === "number") return Number.isFinite(value) ? parseMoneyInput(Math.abs(value).toFixed(2)) : null;
  if (typeof value === "string") {
    const n = parseAmountCell(value);
    return n === null ? null : parseMoneyInput(Math.abs(n).toFixed(2));
  }
  return null;
}

/**
 * One CSV cell. Text that starts with = + - @ is prefixed with an apostrophe so spreadsheet apps can't run it
 * as a formula (CSV injection). Numbers are written as-is so negative amounts stay numeric.
 */
export function csvCell(value: string | number | null | undefined): string {
  if (typeof value === "number") return String(value);
  let s = value ?? "";
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const csvRow = (cells: (string | number | null | undefined)[]) => cells.map(csvCell).join(",") + "\r\n";
