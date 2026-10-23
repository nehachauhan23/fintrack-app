import "server-only";
import { env } from "@/env";
import { db } from "@/server/db";
import { AppError } from "@/lib/errors";

export const dayKey = (d = new Date()) => d.toISOString().slice(0, 10);

/**
 * OpenRouter's free tier is limited by request count (20/min, 50/day until credits are bought), and failed calls
 * can count too. So every upstream call is reserved here first: per user, and across the whole deployment.
 * An advisory lock makes check-then-insert atomic, so concurrent requests cannot overshoot the limit.
 */
export async function reserveAiSlot(userId: string, feature: string, now = new Date()): Promise<string> {
  const day = dayKey(now);
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('fintrack-ai-quota'))`;
    if (env.AI_GLOBAL_DAILY_LIMIT > 0) {
      const used = await tx.aiUsage.count({ where: { day } });
      if (used >= env.AI_GLOBAL_DAILY_LIMIT) {
        throw new AppError("AI_QUOTA", "Today's shared AI allowance is used up. Everything else still works, and AI resets tomorrow (UTC).", 429);
      }
    }
    if (env.AI_USER_DAILY_LIMIT > 0) {
      const used = await tx.aiUsage.count({ where: { day, userId } });
      if (used >= env.AI_USER_DAILY_LIMIT) {
        throw new AppError("AI_QUOTA", `You've used your ${env.AI_USER_DAILY_LIMIT} AI requests for today. They reset tomorrow (UTC).`, 429);
      }
    }
    const row = await tx.aiUsage.create({ data: { userId, day, feature, status: "started" } });
    return row.id;
  });
}

export async function finishAiSlot(
  id: string,
  result: { status: "ok" | "error" | "timeout" | "rate_limited"; model?: string; promptTokens?: number; completionTokens?: number; latencyMs?: number },
): Promise<void> {
  await db.aiUsage.update({ where: { id }, data: result });
}

export async function aiUsageToday(userId: string, now = new Date()) {
  const day = dayKey(now);
  const [mine, shared] = await Promise.all([db.aiUsage.count({ where: { day, userId } }), db.aiUsage.count({ where: { day } })]);
  return { used: mine, limit: env.AI_USER_DAILY_LIMIT, sharedUsed: shared, sharedLimit: env.AI_GLOBAL_DAILY_LIMIT };
}
