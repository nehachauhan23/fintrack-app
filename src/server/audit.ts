import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { logger } from "@/server/logger";

/** Best-effort security/audit trail. A logging failure must never break the user's action. */
export async function audit(
  action: string,
  data: { userId?: string | null; entity?: string; entityId?: string; ip?: string; meta?: Prisma.InputJsonValue } = {},
): Promise<void> {
  try {
    await db.auditLog.create({ data: { action, userId: data.userId ?? null, entity: data.entity, entityId: data.entityId, ip: data.ip, meta: data.meta } });
  } catch (err) {
    logger.warn("audit write failed", { action, err });
  }
}
