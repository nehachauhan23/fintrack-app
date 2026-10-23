"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AppError, invalid } from "@/lib/errors";
import { SUPPORTED_CURRENCIES } from "@/domain/money";
import { audit } from "@/server/audit";
import { passwordSchema } from "@/server/auth/password";
import { rateLimitOrThrow, resetRateLimit } from "@/server/auth/rate-limit";
import { SESSION_COOKIE, createSession, destroyCurrentSession, destroyOtherSessions } from "@/server/auth/session";
import { getUserAgent } from "@/server/request";
import { authenticate, changePassword, deleteAccountWithPassword, normalizeEmail, registerUser, revokeSession, updateProfile } from "@/server/services/auth";
import { authedAction, publicAction } from "./safe-action";

export const signUpAction = publicAction({
  name: "sign-up",
  rateLimit: { limit: 5, windowSec: 3600 },
  input: z.object({ name: z.string().trim().min(1, "Enter your name").max(80), email: z.email("Enter a valid email").max(254), password: passwordSchema }),
  handler: async (input, { ip }) => {
    const { id } = await registerUser(input);
    await createSession(id, { ip, userAgent: await getUserAgent() });
    await audit("auth.sign_up", { userId: id, ip });
    return { ok: true as const };
  },
});

export const signInAction = publicAction({
  name: "sign-in",
  rateLimit: { limit: 20, windowSec: 900 },
  input: z.object({ email: z.email("Enter a valid email").max(254), password: z.string().min(1, "Enter your password").max(200) }),
  handler: async (input, { ip }) => {
    const limitKey = `login:${normalizeEmail(input.email)}`;
    await rateLimitOrThrow(limitKey, { limit: 8, windowSec: 900 });
    try {
      const { id } = await authenticate(input.email, input.password);
      await createSession(id, { ip, userAgent: await getUserAgent() });
      await resetRateLimit(limitKey);
      await audit("auth.sign_in", { userId: id, ip });
      return { ok: true as const };
    } catch (err) {
      if (err instanceof AppError && err.code === "UNAUTHORIZED") await audit("auth.sign_in_failed", { ip });
      throw err;
    }
  },
});
export async function signInDemo() {
  return signInAction({
    email: "demo@fintrack.dev",
    password: "demo-password-123",
  });
}

/** Plain server action (used as a form action): must work even when the session is already invalid. */
export async function signOutAction(): Promise<void> {
  await destroyCurrentSession();
  redirect("/sign-in");
}

export const changePasswordAction = authedAction({
  name: "change-password",
  rateLimit: { limit: 5, windowSec: 900 },
  input: z.object({ currentPassword: z.string().min(1).max(200), newPassword: passwordSchema }),
  handler: async (input, { user }) => {
    await changePassword(user.id, input.currentPassword, input.newPassword);
    const others = await destroyOtherSessions(user.id, user.sessionId);
    await audit("auth.password_changed", { userId: user.id, meta: { otherSessionsRevoked: others } });
    return { otherSessionsRevoked: others };
  },
});

export const updateProfileAction = authedAction({
  name: "update-profile",
  input: z.object({
    name: z.string().trim().min(1).max(80).optional(),
    currency: z.enum(SUPPORTED_CURRENCIES).optional(),
    emailAlerts: z.boolean().optional(),
    aiEnabled: z.boolean().optional(),
  }),
  handler: async (input, { user }) => {
    await updateProfile(user.id, input);
    revalidatePath("/", "layout");
    return { ok: true as const };
  },
});

export const revokeSessionAction = authedAction({
  name: "revoke-session",
  input: z.object({ sessionId: z.uuid() }),
  handler: async ({ sessionId }, { user }) => {
    if (sessionId === user.sessionId) throw invalid("Use \"Sign out\" to end this device's session.");
    await revokeSession(user.id, sessionId);
    revalidatePath("/settings");
    return { ok: true as const };
  },
});

export const signOutOthersAction = authedAction({
  name: "sign-out-others",
  input: z.object({}),
  handler: async (_input, { user }) => {
    const count = await destroyOtherSessions(user.id, user.sessionId);
    await audit("auth.sign_out_others", { userId: user.id, meta: { count } });
    revalidatePath("/settings");
    return { count };
  },
});

export const deleteAccountAction = authedAction({
  name: "delete-account",
  rateLimit: { limit: 3, windowSec: 3600 },
  input: z.object({ password: z.string().min(1).max(200) }),
  handler: async ({ password }, { user }) => {
    await audit("account.deleted", { userId: user.id });
    await deleteAccountWithPassword(user.id, password);
    (await cookies()).delete(SESSION_COOKIE);
    return { ok: true as const };
  },
});
