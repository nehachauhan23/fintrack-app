import "server-only";
import type { RecurringInterval, TransactionType } from "@/generated/prisma/client";
import { Prisma, db } from "@/server/db";
import { invalid, notFound } from "@/lib/errors";
import { directionOf, parseMoneyInput } from "@/domain/money";
import { isCategoryFor } from "@/domain/categories";
import { addDays, formatDateOnly, parseDateOnly, utcToday } from "@/domain/periods";
import { nextAfter, occurrencesBetween } from "@/domain/recurrence";
import { detectSubscriptions, type SubscriptionCandidate, type TxnLite } from "@/domain/anomaly";
import { normalizeMerchant } from "@/domain/merchant";
import { getOwnedAccount } from "./accounts";

const D = Prisma.Decimal;
/** Bounds catch-up work per run; remaining occurrences are picked up by the next run. */
const MAX_CATCH_UP = 60;

export interface RecurringView {
  id: string;
  accountId: string;
  accountName: string;
  type: "INCOME" | "EXPENSE";
  amount: number;
  category: string;
  description: string | null;
  interval: RecurringInterval;
  startDate: string;
  endDate: string | null;
  nextRunOn: string;
  isActive: boolean;
}

type RuleRow = Prisma.RecurringRuleGetPayload<{ include: { account: { select: { name: true } } } }>;
const include = { account: { select: { name: true } } } as const;

const toView = (r: RuleRow): RecurringView => ({
  id: r.id,
  accountId: r.accountId,
  accountName: r.account.name,
  type: r.type as "INCOME" | "EXPENSE",
  amount: r.amount.toNumber(),
  category: r.category,
  description: r.description,
  interval: r.interval,
  startDate: formatDateOnly(r.startDate),
  endDate: r.endDate ? formatDateOnly(r.endDate) : null,
  nextRunOn: formatDateOnly(r.nextRunOn),
  isActive: r.isActive,
});

export async function listRules(userId: string): Promise<RecurringView[]> {
  const rows = await db.recurringRule.findMany({ where: { userId }, include, orderBy: [{ isActive: "desc" }, { nextRunOn: "asc" }] });
  return rows.map(toView);
}

export interface CreateRuleInput {
  accountId: string;
  type: "INCOME" | "EXPENSE";
  amount: string;
  category: string;
  description?: string;
  merchant?: string;
  interval: RecurringInterval;
  startDate: string;
  endDate?: string | null;
}

export async function createRule(userId: string, input: CreateRuleInput, now = new Date()): Promise<RecurringView> {
  const amount = parseMoneyInput(input.amount);
  if (!amount) throw invalid("Enter an amount greater than zero.", { amount: ["Enter a valid amount"] });
  const start = parseDateOnly(input.startDate);
  if (!start) throw invalid("Enter a valid start date.", { startDate: ["Use the format YYYY-MM-DD"] });
  const end = input.endDate ? parseDateOnly(input.endDate) : null;
  if (input.endDate && (!end || end < start)) throw invalid("The end date must be on or after the start date.", { endDate: ["Must not be before the start date"] });
  if (!isCategoryFor(input.category, input.type)) throw invalid("That category does not match the type.", { category: ["Pick a matching category"] });
  await getOwnedAccount(userId, input.accountId);
  const rule = await db.recurringRule.create({
    data: {
      userId, accountId: input.accountId, type: input.type as TransactionType, amount: new D(amount), category: input.category,
      description: input.description?.trim() || null, merchant: input.merchant?.trim() || null,
      interval: input.interval, startDate: start, endDate: end, nextRunOn: start,
    },
  });
  // Materialise anything already due (including past start dates) right away.
  await processRule(rule.id, utcToday(now));
  const fresh = await db.recurringRule.findUniqueOrThrow({ where: { id: rule.id }, include });
  return toView(fresh);
}

export async function updateRule(userId: string, id: string, input: { amount?: string; category?: string; description?: string | null; endDate?: string | null; isActive?: boolean }): Promise<RecurringView> {
  const rule = await db.recurringRule.findFirst({ where: { id, userId } });
  if (!rule) throw notFound("Recurring rule");
  const amount = input.amount ? parseMoneyInput(input.amount) : null;
  if (input.amount && !amount) throw invalid("Enter an amount greater than zero.", { amount: ["Enter a valid amount"] });
  if (input.category && !isCategoryFor(input.category, rule.type)) throw invalid("That category does not match the type.", { category: ["Pick a matching category"] });
  const end = input.endDate ? parseDateOnly(input.endDate) : input.endDate === null ? null : undefined;
  if (input.endDate && !end) throw invalid("Enter a valid end date.", { endDate: ["Use the format YYYY-MM-DD"] });
  const updated = await db.recurringRule.update({
    where: { id },
    data: {
      amount: amount ? new D(amount) : undefined,
      category: input.category,
      description: input.description === undefined ? undefined : input.description?.trim() || null,
      endDate: end,
      isActive: input.isActive,
    },
    include,
  });
  return toView(updated);
}

export async function deleteRule(userId: string, id: string): Promise<void> {
  const r = await db.recurringRule.deleteMany({ where: { id, userId } });
  if (r.count === 0) throw notFound("Recurring rule");
}

/**
 * Generates every occurrence that is due, once.
 * Idempotent by construction: a row lock serialises concurrent workers, and (ruleId, occurrence date) is unique,
 * so a retried or duplicated run can never double-post.
 */
export async function processRule(ruleId: string, today: Date): Promise<{ created: number }> {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM recurring_rules WHERE "id" = ${ruleId} FOR UPDATE`;
    const rule = await tx.recurringRule.findUnique({ where: { id: ruleId }, include: { account: { select: { archivedAt: true } } } });
    if (!rule || !rule.isActive || rule.nextRunOn > today) return { created: 0 };
    if (rule.account.archivedAt) {
      await tx.recurringRule.update({ where: { id: ruleId }, data: { isActive: false } });
      return { created: 0 };
    }
    const dates = occurrencesBetween(rule.startDate, rule.interval, rule.nextRunOn, today, { endDate: rule.endDate, limit: MAX_CATCH_UP });
    const existing = dates.length
      ? await tx.transaction.findMany({ where: { recurringRuleId: ruleId, recurringOn: { in: dates } }, select: { recurringOn: true } })
      : [];
    const done = new Set(existing.map((e) => (e.recurringOn ? formatDateOnly(e.recurringOn) : "")));
    const fresh = dates.filter((d) => !done.has(formatDateOnly(d)));
    if (fresh.length > 0) {
      await tx.transaction.createMany({
        data: fresh.map((d) => ({
          userId: rule.userId, accountId: rule.accountId, type: rule.type, amount: rule.amount, date: d, category: rule.category,
          description: rule.description, merchant: rule.merchant, source: "RECURRING" as const, recurringRuleId: rule.id, recurringOn: d,
        })),
      });
      const delta = rule.amount.mul(directionOf(rule.type)).mul(fresh.length);
      await tx.account.update({ where: { id: rule.accountId }, data: { balance: { increment: delta } } });
    }
    const last = dates[dates.length - 1];
    const next = nextAfter(rule.startDate, rule.interval, last ?? addDays(today, 0));
    const exhausted = rule.endDate !== null && next > rule.endDate;
    await tx.recurringRule.update({ where: { id: ruleId }, data: { lastRunOn: last ?? rule.lastRunOn, nextRunOn: next, isActive: !exhausted } });
    return { created: fresh.length };
  });
}

export async function dueRuleIds(today = utcToday(), take = 500): Promise<string[]> {
  const rows = await db.recurringRule.findMany({ where: { isActive: true, nextRunOn: { lte: today } }, select: { id: true }, orderBy: { nextRunOn: "asc" }, take });
  return rows.map((r) => r.id);
}

export interface UpcomingItem {
  ruleId: string;
  date: string;
  label: string;
  type: "INCOME" | "EXPENSE";
  amount: number;
  category: string;
}

export async function upcomingRecurring(userId: string, days = 30, now = new Date()): Promise<UpcomingItem[]> {
  const today = utcToday(now);
  const horizon = addDays(today, days);
  const rules = await db.recurringRule.findMany({ where: { userId, isActive: true } });
  return rules
    .flatMap((r) =>
      occurrencesBetween(r.startDate, r.interval, r.nextRunOn < today ? today : r.nextRunOn, horizon, { endDate: r.endDate, limit: 12 }).map((d) => ({
        ruleId: r.id, date: formatDateOnly(d), label: r.description || r.merchant || r.category, type: r.type as "INCOME" | "EXPENSE", amount: r.amount.toNumber(), category: r.category,
      })),
    )
    .sort((a, b) => a.date.localeCompare(b.date));
}

export interface SubscriptionSuggestion extends Omit<SubscriptionCandidate, "lastDate" | "nextExpected"> {
  label: string;
  accountId: string;
  lastDate: string;
  nextExpected: string;
}

/** Repeating charges that are not yet tracked by a recurring rule. Purely statistical: no AI involved. */
export async function suggestSubscriptions(userId: string, now = new Date()): Promise<SubscriptionSuggestion[]> {
  const since = addDays(utcToday(now), -400);
  const [rows, rules] = await Promise.all([
    db.transaction.findMany({ where: { userId, type: "EXPENSE", source: { not: "RECURRING" }, date: { gte: since } }, orderBy: { date: "asc" }, take: 3000 }),
    db.recurringRule.findMany({ where: { userId, isActive: true } }),
  ]);
  const labels = new Map<string, { label: string; accountId: string }>();
  const lite: TxnLite[] = rows.map((r) => {
    const text = r.merchant || r.description || "";
    const key = normalizeMerchant(text);
    if (key) labels.set(key, { label: text, accountId: r.accountId });
    return { id: r.id, accountId: r.accountId, category: r.category, amount: r.amount.toNumber(), date: r.date, merchantKey: key };
  });
  const tracked = rules.map((r) => ({ key: normalizeMerchant(r.merchant || r.description || ""), amount: r.amount.toNumber() }));
  return detectSubscriptions(lite)
    .filter((s) => !tracked.some((t) => t.key === s.merchantKey && Math.abs(t.amount - s.amount) <= s.amount * 0.1))
    .slice(0, 8)
    .map((s) => ({
      ...s,
      label: labels.get(s.merchantKey)?.label ?? s.merchantKey,
      accountId: labels.get(s.merchantKey)?.accountId ?? "",
      lastDate: formatDateOnly(s.lastDate),
      nextExpected: formatDateOnly(s.nextExpected),
    }));
}
