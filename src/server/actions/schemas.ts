import { z } from "zod";
import { parseMoneyInput } from "@/domain/money";
import { addDays, formatDateOnly, utcToday } from "@/domain/periods";

export const id = z.uuid();
export const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD");
/** A calendar date no later than tomorrow (one day of slack for time zones ahead of UTC). */
export const notFutureDate = dateStr.refine((d) => d <= formatDateOnly(addDays(utcToday(), 1)), "The date can't be in the future");
export const category = z.string().min(1).max(40);
export const periodKey = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

/** Accepts "1,234.5" and canonicalises it to "1234.50"; rejects zero, negatives and junk. */
export const money = z.string().max(24).transform((s, ctx) => {
  const c = parseMoneyInput(s);
  if (!c) {
    ctx.addIssue({ code: "custom", message: "Enter an amount greater than zero, e.g. 12.50" });
    return z.NEVER;
  }
  return c;
});

export const text = (max: number) => z.string().trim().max(max);
