import "server-only";
import { headers } from "next/headers";

/**
 * Best-effort client IP. Only trust x-forwarded-for when the app runs behind a proxy you control
 * (Vercel, Cloudflare, nginx); otherwise a client can spoof it and dodge IP-based limits.
 */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || h.get("x-real-ip") || "unknown";
}

export async function getUserAgent(): Promise<string | undefined> {
  return (await headers()).get("user-agent")?.slice(0, 255) ?? undefined;
}
