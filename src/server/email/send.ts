import "server-only";
import { env } from "@/env";
import { logger } from "@/server/logger";

export interface Email {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Sends through Resend's REST API. Without RESEND_API_KEY the email is logged instead, so local development
 * and previews work without credentials. Errors are thrown so the calling job retries.
 */
export async function sendEmail(email: Email): Promise<{ sent: boolean }> {
  if (!env.RESEND_API_KEY) {
    logger.info("email.not_sent_no_provider", { subject: email.subject });
    return { sent: false };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: [email.to], subject: email.subject, html: email.html, text: email.text }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Email provider responded ${res.status}`);
  return { sent: true };
}
