import "server-only";
import { db } from "@/server/db";
import { addDays } from "@/domain/periods";

/** Housekeeping: keeps the operational tables from growing without bound. */
export async function runMaintenance(now = new Date()) {
  const [sessions, rateLimits, aiUsage, auditLogs] = await Promise.all([
    db.session.deleteMany({ where: { expiresAt: { lt: now } } }),
    db.rateLimit.deleteMany({ where: { resetAt: { lt: now } } }),
    db.aiUsage.deleteMany({ where: { createdAt: { lt: addDays(now, -90) } } }),
    db.auditLog.deleteMany({ where: { createdAt: { lt: addDays(now, -365) } } }),
  ]);
  return { sessions: sessions.count, rateLimits: rateLimits.count, aiUsage: aiUsage.count, auditLogs: auditLogs.count };
}
