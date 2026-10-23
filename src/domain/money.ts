/**
 * Money helpers. Amounts cross the client/server boundary as canonical decimal strings ("123.45")
 * and are persisted as DECIMAL(14,2); they are never parsed through floating point on the write path.
 */
export type TransactionTypeName = "INCOME" | "EXPENSE" | "TRANSFER_IN" | "TRANSFER_OUT";

const AMOUNT_RE = /^\d{1,12}(\.\d{1,2})?$/;

/** Returns a canonical positive amount string with two decimals, or null if the input is invalid. */
export function parseMoneyInput(raw: string): string | null {
  const s = raw.trim().replace(/[,\s]/g, "");
  if (!AMOUNT_RE.test(s)) return null;
  const [int = "0", frac = ""] = s.split(".");
  const out = `${int.replace(/^0+(?=\d)/, "")}.${frac.padEnd(2, "0")}`;
  return Number(out) > 0 ? out : null;
}

export function toMinor(value: number | string): number {
  return Math.round(Number(value) * 100);
}

export function fromMinor(minor: number): number {
  return minor / 100;
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** +1 for money coming in, -1 for money going out. */
export function directionOf(type: TransactionTypeName): 1 | -1 {
  return type === "INCOME" || type === "TRANSFER_IN" ? 1 : -1;
}

export function isTransfer(type: TransactionTypeName): boolean {
  return type === "TRANSFER_IN" || type === "TRANSFER_OUT";
}

export const SUPPORTED_CURRENCIES = ["USD", "EUR", "GBP", "INR", "AUD", "CAD", "JPY", "SGD", "AED"] as const;
export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];

/** Signed balance input (may be zero or negative, e.g. a credit card that is owed). Canonical "-12.30" / "0.00" or null. */
export function parseBalanceInput(raw: string): string | null {
  const s = raw.trim().replace(/[,\s]/g, "");
  if (!/^-?\d{1,12}(\.\d{1,2})?$/.test(s)) return null;
  const negative = s.startsWith("-");
  const [int = "0", frac = ""] = s.replace("-", "").split(".");
  const body = `${int.replace(/^0+(?=\d)/, "")}.${frac.padEnd(2, "0")}`;
  return negative && Number(body) !== 0 ? `-${body}` : body;
}
