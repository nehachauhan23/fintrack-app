import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { unauthorized } from "@/lib/errors";
import { readSession, type AuthUser } from "./session";

/**
 * Data-access layer for authentication. Authorisation is enforced here, next to the data,
 * and not only in the proxy (middleware): the proxy is just an optimistic redirect.
 */
export const getCurrentUser = cache(async (): Promise<AuthUser | null> => readSession());

/** For pages/layouts: redirects anonymous visitors to sign-in. */
export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return user;
}

/** For server actions and route handlers: throws instead of redirecting. Never returns a half-authenticated value. */
export async function requireUserOrThrow(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) throw unauthorized();
  return user;
}
