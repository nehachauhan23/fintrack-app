import "server-only";
import { db } from "@/server/db";
import { AppError, conflict, notFound } from "@/lib/errors";
import { burnPasswordCheck, hashPassword, verifyPassword } from "@/server/auth/password";

const invalidCredentials = () => new AppError("UNAUTHORIZED", "Incorrect email or password.", 401);

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export async function registerUser(input: { name: string; email: string; password: string }): Promise<{ id: string }> {
  const email = normalizeEmail(input.email);
  if (await db.user.findUnique({ where: { email }, select: { id: true } })) throw conflict("An account with this email already exists.");
  const user = await db.user.create({ data: { name: input.name.trim(), email, passwordHash: await hashPassword(input.password) }, select: { id: true } });
  return user;
}

/** Same error and same work whether the email is unknown or the password is wrong, so neither can be probed. */
export async function authenticate(emailRaw: string, password: string): Promise<{ id: string }> {
  const user = await db.user.findUnique({ where: { email: normalizeEmail(emailRaw) } });
  if (!user) {
    await burnPasswordCheck(password);
    throw invalidCredentials();
  }
  const { valid, needsRehash } = await verifyPassword(password, user.passwordHash);
  if (!valid) throw invalidCredentials();
  if (needsRehash) await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password) } });
  return { id: user.id };
}

export async function changePassword(userId: string, current: string, next: string): Promise<void> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw notFound("User");
  if (!(await verifyPassword(current, user.passwordHash)).valid) throw new AppError("VALIDATION", "Your current password is incorrect.", 422, { currentPassword: ["Incorrect password"] });
  await db.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(next) } });
}

export async function updateProfile(userId: string, input: { name?: string; currency?: string; emailAlerts?: boolean; aiEnabled?: boolean }): Promise<void> {
  await db.user.update({ where: { id: userId }, data: { name: input.name?.trim(), currency: input.currency, emailAlerts: input.emailAlerts, aiEnabled: input.aiEnabled } });
}

export async function deleteAccountWithPassword(userId: string, password: string): Promise<void> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw notFound("User");
  if (!(await verifyPassword(password, user.passwordHash)).valid) throw new AppError("VALIDATION", "Password is incorrect.", 422, { password: ["Incorrect password"] });
  await db.user.delete({ where: { id: userId } }); // cascades to every owned row
}

export interface SessionView {
  id: string;
  current: boolean;
  userAgent: string | null;
  ip: string | null;
  createdAt: string;
  lastUsedAt: string;
}

export async function listSessions(userId: string, currentSessionId: string): Promise<SessionView[]> {
  const rows = await db.session.findMany({ where: { userId, expiresAt: { gt: new Date() } }, orderBy: { lastUsedAt: "desc" } });
  return rows.map((s) => ({ id: s.id, current: s.id === currentSessionId, userAgent: s.userAgent, ip: s.ip, createdAt: s.createdAt.toISOString(), lastUsedAt: s.lastUsedAt.toISOString() }));
}

export async function revokeSession(userId: string, sessionId: string): Promise<void> {
  const r = await db.session.deleteMany({ where: { id: sessionId, userId } });
  if (r.count === 0) throw notFound("Session");
}

/** Everything the app holds about a user, as plain JSON (credentials and session tokens excluded). */
export async function exportUserData(userId: string) {
  const [user, accounts, transactions, recurring, budgets, goals, merchantRules] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true, currency: true, emailAlerts: true, aiEnabled: true, createdAt: true } }),
    db.account.findMany({ where: { userId } }),
    db.transaction.findMany({ where: { userId }, orderBy: { date: "asc" } }),
    db.recurringRule.findMany({ where: { userId } }),
    db.budget.findMany({ where: { userId } }),
    db.goal.findMany({ where: { userId }, include: { contributions: true } }),
    db.merchantRule.findMany({ where: { userId } }),
  ]);
  return JSON.parse(JSON.stringify({ exportedAt: new Date().toISOString(), user, accounts, transactions, recurring, budgets, goals, merchantRules }));
}
