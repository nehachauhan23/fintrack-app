import "server-only";
import { env } from "@/env";
import { AppError } from "@/lib/errors";
import { logger } from "@/server/logger";
import { stripThinking } from "./json";
import { finishAiSlot, reserveAiSlot } from "./quota";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

export type ContentPart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
}

export interface ChatOptions {
  feature: string;
  userId: string;
  messages: ChatMessage[];
  /** Use the image-capable model list. */
  vision?: boolean;
  /** Hint that the reply should be a JSON object (some models ignore this, so output is always validated). */
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
}

export interface ChatResult {
  text: string;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
}

export const aiConfigured = () => Boolean(env.OPENROUTER_API_KEY);

/** Translates provider failures into messages that tell the user what to do, without leaking provider internals. */
export function mapProviderError(status: number, providerMessage: string): AppError {
  if (status === 401 || status === 403) return new AppError("AI_UNAVAILABLE", "The AI provider rejected this server's API key.", 502);
  if (status === 402) return new AppError("AI_UNAVAILABLE", "The AI provider reports no remaining credits for this model.", 502);
  if (status === 404 && /data.?polic|no endpoints|privacy/i.test(providerMessage)) {
    return new AppError(
      "AI_UNAVAILABLE",
      "No AI provider currently matches the privacy setting (OPENROUTER_DATA_COLLECTION=deny). Use a paid model, or set it to \"allow\" if you accept free providers logging prompts.",
      502,
    );
  }
  if (status === 408 || status === 504) return new AppError("AI_UNAVAILABLE", "The AI took too long to respond. Try again.", 504);
  if (status === 429) return new AppError("AI_QUOTA", "The AI provider is rate-limiting requests (free models allow about 20 per minute and 50 per day). Try again shortly.", 429);
  return new AppError("AI_UNAVAILABLE", `The AI provider had a problem (status ${status}). Try again.`, 502);
}

/**
 * One upstream request with server-side model fallback (`models`), a provider privacy filter, a timeout,
 * quota accounting, and no prompt/response logging.
 */
export async function chat(opts: ChatOptions): Promise<ChatResult> {
  if (!env.OPENROUTER_API_KEY) throw new AppError("AI_UNAVAILABLE", "AI features aren't configured on this server (missing OPENROUTER_API_KEY).", 503);
  const models = opts.vision ? env.OPENROUTER_VISION_MODELS : env.OPENROUTER_MODELS;
  if (models.length === 0) throw new AppError("AI_UNAVAILABLE", "No AI models are configured.", 503);

  const slot = await reserveAiSlot(opts.userId, opts.feature);
  const started = Date.now();
  const latency = () => Date.now() - started;
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": env.APP_URL,
        "X-Title": "FinTrack",
      },
      body: JSON.stringify({
        ...(models.length > 1 ? { models } : { model: models[0] }),
        messages: opts.messages,
        temperature: opts.temperature ?? 0.2,
        max_tokens: opts.maxTokens ?? 1200,
        ...(opts.json ? { response_format: { type: "json_object" } } : {}),
        provider: { data_collection: env.OPENROUTER_DATA_COLLECTION },
      }),
      signal: AbortSignal.timeout(env.AI_TIMEOUT_MS),
    });
    const payload = (await res.json().catch(() => null)) as {
      error?: { message?: string; code?: number | string };
      choices?: { message?: { content?: string | null } }[];
      model?: string;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    } | null;

    if (!res.ok || payload?.error) {
      const status = res.ok ? Number(payload?.error?.code) || 502 : res.status;
      const message = payload?.error?.message ?? res.statusText;
      logger.warn("ai.upstream_error", { feature: opts.feature, status, message: message.slice(0, 200) });
      throw mapProviderError(status, message);
    }
    const text = stripThinking(payload?.choices?.[0]?.message?.content ?? "");
    if (!text) throw new AppError("AI_UNAVAILABLE", "The model returned an empty answer. Try again.", 502);

    const result: ChatResult = { text, model: payload?.model ?? models[0] ?? "unknown", promptTokens: payload?.usage?.prompt_tokens, completionTokens: payload?.usage?.completion_tokens };
    await finishAiSlot(slot, { status: "ok", model: result.model, promptTokens: result.promptTokens, completionTokens: result.completionTokens, latencyMs: latency() });
    logger.info("ai.request", { feature: opts.feature, model: result.model, ms: latency(), promptTokens: result.promptTokens, completionTokens: result.completionTokens });
    return result;
  } catch (err) {
    const timedOut = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    const status = err instanceof AppError && err.code === "AI_QUOTA" ? "rate_limited" : timedOut ? "timeout" : "error";
    await finishAiSlot(slot, { status, latencyMs: latency() }).catch(() => undefined);
    if (err instanceof AppError) throw err;
    if (timedOut) throw new AppError("AI_UNAVAILABLE", "The AI took too long to respond. Try again.", 504);
    logger.error("ai.request_failed", { feature: opts.feature, err });
    throw new AppError("AI_UNAVAILABLE", "Couldn't reach the AI service. Try again.", 502);
  }
}
