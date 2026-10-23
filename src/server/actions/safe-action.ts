import "server-only";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import type { ActionResult } from "@/lib/result";
import { requireUserOrThrow } from "@/server/auth/dal";
import type { AuthUser } from "@/server/auth/session";
import { rateLimitOrThrow, type RateLimitOptions } from "@/server/auth/rate-limit";
import { getClientIp } from "@/server/request";
import { logger } from "@/server/logger";
import { Prisma } from "@/server/db";

interface Base<S extends z.ZodType> {
  name: string;
  input: S;
  rateLimit?: RateLimitOptions;
}

const DEFAULT_LIMIT: RateLimitOptions = { limit: 120, windowSec: 60 };

function failure(err: unknown, name: string): ActionResult<never> {
  // redirect() / notFound() are implemented with thrown control-flow errors that must keep propagating.
  unstable_rethrow(err);
  if (err instanceof z.ZodError) {
    return { ok: false, error: { code: "VALIDATION", message: "Please check the highlighted fields.", fieldErrors: z.flattenError(err).fieldErrors as Record<string, string[]> } };
  }
  if (err instanceof AppError) {
    return { ok: false, error: { code: err.code, message: err.message, fieldErrors: err.fieldErrors } };
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") return { ok: false, error: { code: "CONFLICT", message: "That already exists." } };
    if (err.code === "P2025") return { ok: false, error: { code: "NOT_FOUND", message: "Item not found." } };
  }
  logger.error("action failed", { action: name, err });
  return { ok: false, error: { code: "INTERNAL", message: "Something went wrong. Please try again." } };
}

function parse<S extends z.ZodType>(schema: S, raw: unknown): z.output<S> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw parsed.error;
  return parsed.data;
}

/** A server action that requires a signed-in user. Validation, auth, rate limiting and error mapping happen in one place. */
export function authedAction<S extends z.ZodType, O>(
  cfg: Base<S> & { handler: (input: z.output<S>, ctx: { user: AuthUser }) => Promise<O> },
): (raw: z.input<S>) => Promise<ActionResult<O>> {
  return async (raw) => {
    try {
      const user = await requireUserOrThrow();
      const input = parse(cfg.input, raw);
      await rateLimitOrThrow(`action:${cfg.name}:${user.id}`, cfg.rateLimit ?? DEFAULT_LIMIT);
      return { ok: true, data: await cfg.handler(input, { user }) };
    } catch (err) {
      return failure(err, cfg.name);
    }
  };
}

/** A server action for anonymous callers (sign-in / sign-up). Always rate-limited by client IP. */
export function publicAction<S extends z.ZodType, O>(
  cfg: Base<S> & { rateLimit: RateLimitOptions; handler: (input: z.output<S>, ctx: { ip: string }) => Promise<O> },
): (raw: z.input<S>) => Promise<ActionResult<O>> {
  return async (raw) => {
    try {
      const ip = await getClientIp();
      await rateLimitOrThrow(`public:${cfg.name}:${ip}`, cfg.rateLimit);
      const input = parse(cfg.input, raw);
      return { ok: true, data: await cfg.handler(input, { ip }) };
    } catch (err) {
      return failure(err, cfg.name);
    }
  };
}
