import "server-only";
import { Prisma, db } from "@/server/db";
import { invalid, notFound } from "@/lib/errors";
import { parseMoneyInput } from "@/domain/money";
import { diffDays, formatDateOnly, parseDateOnly, utcToday } from "@/domain/periods";

const D = Prisma.Decimal;

export interface GoalView {
  id: string;
  name: string;
  target: number;
  saved: number;
  pct: number;
  remaining: number;
  deadline: string | null;
  completed: boolean;
  monthlyNeeded: number | null;
}

type GoalRow = Prisma.GoalGetPayload<object>;

function toView(g: GoalRow, now = new Date()): GoalView {
  const target = g.targetAmount.toNumber();
  const saved = g.savedAmount.toNumber();
  const remaining = Math.max(0, target - saved);
  const completed = g.completedAt !== null;
  let monthlyNeeded: number | null = null;
  if (g.deadline && !completed) {
    const monthsLeft = Math.max(1, Math.ceil(diffDays(g.deadline, utcToday(now)) / 30.44));
    monthlyNeeded = remaining / monthsLeft;
  }
  return { id: g.id, name: g.name, target, saved, pct: target > 0 ? Math.min(100, (saved / target) * 100) : 0, remaining, deadline: g.deadline ? formatDateOnly(g.deadline) : null, completed, monthlyNeeded };
}

async function owned(userId: string, id: string, client: Prisma.TransactionClient | typeof db = db): Promise<GoalRow> {
  const g = await client.goal.findFirst({ where: { id, userId, archivedAt: null } });
  if (!g) throw notFound("Goal");
  return g;
}

export async function listGoals(userId: string): Promise<GoalView[]> {
  const rows = await db.goal.findMany({ where: { userId, archivedAt: null }, orderBy: [{ completedAt: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }] });
  return rows.map((g) => toView(g));
}

export async function createGoal(userId: string, input: { name: string; targetAmount: string; deadline?: string | null }): Promise<GoalView> {
  const target = parseMoneyInput(input.targetAmount);
  if (!target) throw invalid("Enter a target greater than zero.", { targetAmount: ["Enter a valid amount"] });
  const deadline = input.deadline ? parseDateOnly(input.deadline) : null;
  if (input.deadline && !deadline) throw invalid("Enter a valid deadline.", { deadline: ["Use the format YYYY-MM-DD"] });
  const g = await db.goal.create({ data: { userId, name: input.name.trim(), targetAmount: new D(target), deadline } });
  return toView(g);
}

export async function updateGoal(userId: string, id: string, input: { name?: string; targetAmount?: string; deadline?: string | null }): Promise<GoalView> {
  const goal = await owned(userId, id);
  const target = input.targetAmount ? parseMoneyInput(input.targetAmount) : null;
  if (input.targetAmount && !target) throw invalid("Enter a target greater than zero.", { targetAmount: ["Enter a valid amount"] });
  const newTarget = target ? new D(target) : goal.targetAmount;
  const updated = await db.goal.update({
    where: { id },
    data: {
      name: input.name?.trim(),
      targetAmount: newTarget,
      deadline: input.deadline === undefined ? undefined : input.deadline ? parseDateOnly(input.deadline) : null,
      completedAt: goal.savedAmount.gte(newTarget) ? (goal.completedAt ?? new Date()) : null,
    },
  });
  return toView(updated);
}

export async function archiveGoal(userId: string, id: string): Promise<void> {
  await owned(userId, id);
  await db.goal.update({ where: { id }, data: { archivedAt: new Date() } });
}

export async function contributeToGoal(userId: string, id: string, input: { kind: "deposit" | "withdraw"; amount: string; note?: string; date: string }): Promise<GoalView> {
  const amount = parseMoneyInput(input.amount);
  if (!amount) throw invalid("Enter an amount greater than zero.", { amount: ["Enter a valid amount"] });
  const date = parseDateOnly(input.date);
  if (!date) throw invalid("Enter a valid date.", { date: ["Use the format YYYY-MM-DD"] });
  return db.$transaction(async (tx) => {
    const goal = await owned(userId, id, tx); 
    const signed = input.kind === "deposit" ? new D(amount) : new D(amount).neg();
    const saved = goal.savedAmount.plus(signed);
    if (saved.isNegative()) throw invalid("You can't withdraw more than has been saved.", { amount: ["Exceeds the saved amount"] });
    await tx.goalContribution.create({ data: { goalId: id, userId, amount: signed, note: input.note?.trim() || null, date} });
    const updated = await tx.goal.update({
      where: { id },
      data: { savedAmount: saved, completedAt: saved.gte(goal.targetAmount) ? (goal.completedAt ?? new Date()) : null },
    });
    return toView(updated);
  });
}
