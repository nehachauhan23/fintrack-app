import "server-only";
import { z } from "zod";
import { type Prisma, db } from "@/server/db";
import type { AuthUser } from "@/server/auth/session";
import { CATEGORIES, categoryName } from "@/domain/categories";
import { aggregate, type Group, type GroupBy, type Metric, type QueryRow } from "@/domain/query";
import { addDays, diffDays, formatDateOnly, parseDateOnly, utcToday } from "@/domain/periods";
import { formatDate } from "@/lib/format";
import { assertAiAllowed, generateObject } from "./generate";
import { SYSTEM_BASE, categoryCatalog } from "./prompts";
import { fence } from "./sanitize";
import { describeAnswer } from "./answer";

const MAX_ROWS = 20_000;

export const planSchema = z.object({
  kind: z.enum(["answer", "unsupported"]).default("answer"),
  metric: z.enum(["expense", "income", "net", "count"]).default("expense"),
  groupBy: z.enum(["none", "category", "merchant", "month", "account"]).default("none"),
  from: z.string().default(""),
  to: z.string().default(""),
  categories: z.array(z.string().max(40)).max(10).default([]),
  merchantContains: z.string().max(60).nullish(),
  accounts: z.array(z.string().max(60)).max(10).default([]),
  compareWithPrevious: z.boolean().default(false),
  limit: z.number().int().min(1).max(20).default(8),
  reason: z.string().max(240).nullish(),
});
export type Plan = z.infer<typeof planSchema>;

export interface AssistantAnswer {
  kind: "answer";
  question: string;
  summary: string;
  metric: Metric;
  groupBy: GroupBy;
  from: string;
  to: string;
  total: number;
  count: number;
  groups: Group[];
  previousTotal: number | null;
  notes: string[];
  plan: Plan;
}
export type AssistantReply = AssistantAnswer | { kind: "unsupported"; message: string };

export interface AssistantAccount {
  id: string;
  name: string;
}

function resolveCategories(requested: string[], notes: string[]): string[] {
  const byName = new Map(CATEGORIES.flatMap((c) => [[c.id, c.id] as const, [c.name.toLowerCase(), c.id] as const]));
  const out: string[] = [];
  for (const r of requested) {
    const id = byName.get(r.trim().toLowerCase());
    if (id) out.push(id);
    else notes.push(`Ignored unknown category "${r.slice(0, 30)}".`);
  }
  return out;
}

/**
 * Executes a validated plan against the database. The model only chooses *which* of a fixed set of filters
 * to apply; it never writes SQL, and all numbers in the reply come from here.
 */
export async function runPlan(userId: string, plan: Plan, accounts: AssistantAccount[], currency: string, now = new Date()): Promise<AssistantAnswer> {
  const notes: string[] = [];
  const today = utcToday(now);
  let to = parseDateOnly(plan.to) ?? today;
  let from = parseDateOnly(plan.from) ?? new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  if (!parseDateOnly(plan.from) || !parseDateOnly(plan.to)) notes.push("No clear dates were given, so this covers the current month so far.");
  if (from > to) [from, to] = [to, from];
  if (to > today) to = today;
  if (diffDays(to, from) > 366 * 5) {
    from = addDays(to, -366 * 5);
    notes.push("Limited to the last five years.");
  }

  const categories = resolveCategories(plan.categories, notes);
  const accountIds = plan.accounts.flatMap((name) => {
    const match = accounts.find((a) => a.name.toLowerCase() === name.trim().toLowerCase());
    if (!match) notes.push(`Ignored unknown account "${name.slice(0, 30)}".`);
    return match ? [match.id] : [];
  });
  const merchant = plan.merchantContains?.trim() || null;

  const baseWhere = (f: Date, t: Date): Prisma.TransactionWhereInput => ({
    userId,
    date: { gte: f, lte: t },
    type: plan.metric === "expense" ? "EXPENSE" : plan.metric === "income" ? "INCOME" : { in: ["INCOME", "EXPENSE"] },
    ...(categories.length ? { category: { in: categories } } : {}),
    ...(accountIds.length ? { accountId: { in: accountIds } } : {}),
    ...(merchant ? { OR: [{ merchant: { contains: merchant, mode: "insensitive" } }, { description: { contains: merchant, mode: "insensitive" } }] } : {}),
  });

  const fetchRows = async (f: Date, t: Date): Promise<QueryRow[]> => {
    const rows = await db.transaction.findMany({
      where: baseWhere(f, t),
      select: { date: true, amount: true, type: true, category: true, merchant: true, description: true, accountId: true },
      orderBy: { date: "desc" },
      take: MAX_ROWS + 1,
    });
    if (rows.length > MAX_ROWS) notes.push(`Only the most recent ${MAX_ROWS.toLocaleString()} matching transactions were counted.`);
    return rows.slice(0, MAX_ROWS).map((r) => ({ ...r, amount: r.amount.toNumber(), type: r.type as "INCOME" | "EXPENSE" }));
  };

  const accountName = new Map(accounts.map((a) => [a.id, a.name]));
  const label = (by: GroupBy, key: string, fallback: string) =>
    by === "category" ? categoryName(key) : by === "account" ? (accountName.get(key) ?? "Account") : by === "month" ? formatDate(`${key}-01`, "month") : fallback;

  const rows = await fetchRows(from, to);
  const result = aggregate(rows, { metric: plan.metric, groupBy: plan.groupBy, limit: plan.limit, label });

  let previousTotal: number | null = null;
  if (plan.compareWithPrevious) {
    const len = diffDays(to, from) + 1;
    const prevTo = addDays(from, -1);
    const prevFrom = addDays(prevTo, -(len - 1));
    previousTotal = aggregate(await fetchRows(prevFrom, prevTo), { metric: plan.metric, groupBy: "none", limit: 1 }).total;
  }

  const scopeParts: string[] = [];
  if (categories.length) scopeParts.push(`on ${categories.map(categoryName).join(", ")}`);
  if (merchant) scopeParts.push(`matching "${merchant}"`);
  if (accountIds.length) scopeParts.push(`in ${accountIds.map((id) => accountName.get(id)).join(", ")}`);

  return {
    kind: "answer",
    question: "",
    summary: describeAnswer({ metric: plan.metric, total: result.total, count: result.count, from: formatDateOnly(from), to: formatDateOnly(to), scope: scopeParts.join(" ") || null, currency, previousTotal }),
    metric: plan.metric,
    groupBy: plan.groupBy,
    from: formatDateOnly(from),
    to: formatDateOnly(to),
    total: result.total,
    count: result.count,
    groups: result.groups,
    previousTotal,
    notes,
    plan,
  };
}

/** One AI call turns the question into a plan; the database answers it. */
export async function askAssistant(
  user: AuthUser,
  question: string,
  today: string,
  accounts: AssistantAccount[],
  history: { question: string; plan: Plan }[] = [],
  now = new Date(),
): Promise<AssistantReply> {
  assertAiAllowed(user);
  const todayDate = parseDateOnly(today) ?? utcToday(now);
  const context = history
    .slice(-2)
    .map((h) => `Earlier question: ${fence(h.question, 200)}\nEarlier plan: ${JSON.stringify({ ...h.plan, reason: undefined })}`)
    .join("\n");

  const { data } = await generateObject({
    feature: "assistant",
    userId: user.id,
    maxTokens: 500,
    schema: planSchema,
    messages: [
      { role: "system", content: SYSTEM_BASE },
      {
        role: "user",
        content:
          `Today is ${formatDateOnly(todayDate)}. Convert the question into a query plan over the user's transactions. Return JSON:\n` +
          `{"kind":"answer"|"unsupported","metric":"expense"|"income"|"net"|"count","groupBy":"none"|"category"|"merchant"|"month"|"account","from":"YYYY-MM-DD","to":"YYYY-MM-DD","categories":string[],"merchantContains":string|null,"accounts":string[],"compareWithPrevious":boolean,"limit":number,"reason":string|null}\n` +
          `Rules: resolve relative dates ("last month", "this year") from today; "to" is inclusive. Use kind "unsupported" (with a short reason) for anything that is not a question about transactions, spending, income or cash flow. ` +
          `Use groupBy "category"/"merchant" for "where/what/which" questions and "month" for trends. Set compareWithPrevious when the question compares periods.\n` +
          `Valid category ids:\n${categoryCatalog("ALL")}\nAccounts: ${accounts.map((a) => a.name).join(", ") || "(none)"}\n` +
          (context ? `${context}\n` : "") +
          `Question: ${fence(question, 300)}`,
      },
    ],
  });

  if (data.kind === "unsupported") {
    return { kind: "unsupported", message: data.reason?.trim() || "I can answer questions about your spending, income and cash flow, for example \"how much did I spend on food last month?\"." };
  }
  const answer = await runPlan(user.id, data, accounts, user.currency, now);
  return { ...answer, question };
}
