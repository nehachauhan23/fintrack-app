import "server-only";
import { db } from "@/server/db";
import { rateLimited } from "@/lib/errors";

export interface RateLimitOptions {
  limit: number;
  windowSec: number;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
}

/**
 * Fixed-window limiter backed by Postgres, so it holds across serverless instances.
 * One atomic upsert per check; stale rows are purged by the nightly maintenance job.
 */
export async function rateLimit(key: string, { limit, windowSec }: RateLimitOptions, now = new Date()): Promise<RateLimitResult> {
  const resetAt = new Date(now.getTime() + windowSec * 1000);
  const rows = await db.$queryRaw<{ count: number; resetAt: Date }[]>`
    INSERT INTO rate_limits ("key", "count", "resetAt")
    VALUES (${key}, 1, ${resetAt})
    ON CONFLICT ("key") DO UPDATE SET
      "count"   = CASE WHEN rate_limits."resetAt" <= ${now} THEN 1 ELSE rate_limits."count" + 1 END,
      "resetAt" = CASE WHEN rate_limits."resetAt" <= ${now} THEN ${resetAt} ELSE rate_limits."resetAt" END
    RETURNING "count", "resetAt"`;
  const row = rows[0];
  const count = Number(row?.count ?? 1);
  const retryAfterSec = Math.max(0, Math.ceil(((row?.resetAt ?? resetAt).getTime() - now.getTime()) / 1000));
  return { ok: count <= limit, remaining: Math.max(0, limit - count), retryAfterSec };
}

export async function rateLimitOrThrow(key: string, opts: RateLimitOptions): Promise<void> {
  const r = await rateLimit(key, opts);
  if (!r.ok) throw rateLimited(r.retryAfterSec);
}

/** Clears a counter, e.g. after a successful login. */
export async function resetRateLimit(key: string): Promise<void> {
  await db.rateLimit.deleteMany({ where: { key } });
}
