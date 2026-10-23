import "server-only";
import { cookies } from "next/headers";
import { env } from "@/env";
import { db } from "@/server/db";
import { hashSessionToken, newSessionToken } from "./tokens";

export const SESSION_COOKIE = "ft_session";
const TOUCH_INTERVAL_MS = 60 * 60 * 1000;

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  currency: string;
  emailAlerts: boolean;
  aiEnabled: boolean;
  sessionId: string;
}

export async function createSession(userId: string, meta: { ip?: string; userAgent?: string } = {}): Promise<void> {
  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + env.SESSION_TTL_DAYS * 86_400_000);
  await db.session.create({ data: { userId, tokenHash: hashSessionToken(token), expiresAt, ip: meta.ip, userAgent: meta.userAgent } });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

/** Resolves the cookie to a user, or null. Never throws for a bad/expired token. */
export async function readSession(): Promise<AuthUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { user: { select: { id: true, email: true, name: true, currency: true, emailAlerts: true, aiEnabled: true } } },
  });
  if (!session || session.expiresAt.getTime() <= Date.now()) return null;
  if (Date.now() - session.lastUsedAt.getTime() > TOUCH_INTERVAL_MS) {
    // Fire-and-forget: a failed touch must never fail the request.
    void db.session.update({ where: { id: session.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);
  }
  return { ...session.user, sessionId: session.id };
}

export async function destroyCurrentSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: hashSessionToken(token) } });
  jar.delete(SESSION_COOKIE);
}

export async function destroyOtherSessions(userId: string, keepSessionId: string): Promise<number> {
  const r = await db.session.deleteMany({ where: { userId, id: { not: keepSessionId } } });
  return r.count;
}
