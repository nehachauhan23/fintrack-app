import "server-only";
import { type z } from "zod";
import { AppError } from "@/lib/errors";
import type { AuthUser } from "@/server/auth/session";
import { extractJson } from "./json";
import { aiConfigured, chat, type ChatMessage, type ChatOptions } from "./openrouter";

/** Fails fast, before any quota is spent, when AI cannot be used for this user. */
export function assertAiAllowed(user: Pick<AuthUser, "aiEnabled">): void {
  if (!user.aiEnabled) throw new AppError("FORBIDDEN", "AI features are turned off in your settings.", 403);
  if (!aiConfigured()) throw new AppError("AI_UNAVAILABLE", "AI features aren't configured on this server.", 503);
}

export interface GenerateOptions<S extends z.ZodType> extends Omit<ChatOptions, "json"> {
  schema: S;
  /** Total upstream calls allowed, including the first. A repair retry costs one more request from the quota. */
  maxAttempts?: number;
}

/**
 * Calls the model and validates the answer against a zod schema. If the reply is malformed it gets one chance
 * to repair it. Anything that still fails validation is rejected: unvalidated model output never reaches the app.
 */
export async function generateObject<S extends z.ZodType>(opts: GenerateOptions<S>): Promise<{ data: z.output<S>; model: string }> {
  const maxAttempts = opts.maxAttempts ?? 2;
  const messages: ChatMessage[] = [...opts.messages];
  let lastProblem = "";
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await chat({ ...opts, messages, json: true });
    try {
      const parsed = opts.schema.safeParse(extractJson(result.text));
      if (parsed.success) return { data: parsed.data, model: result.model };
      lastProblem = parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
    } catch (err) {
      lastProblem = err instanceof Error ? err.message : "invalid JSON";
    }
    messages.push(
      { role: "assistant", content: result.text.slice(0, 1500) },
      { role: "user", content: `That reply was invalid (${lastProblem}). Reply again with ONLY a valid JSON object that matches the requested shape.` },
    );
  }
  throw new AppError("AI_UNAVAILABLE", "The AI gave an answer that couldn't be used. Try again, or rephrase.", 502);
}
