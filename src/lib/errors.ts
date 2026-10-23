export type ErrorCode =
  | "VALIDATION"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "AI_UNAVAILABLE"
  | "AI_QUOTA"
  | "INTERNAL";

/** Errors that are safe to show to the user. Anything else is logged and replaced by a generic message. */
export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly status = 400,
    public readonly fieldErrors?: Record<string, string[]>,
    public readonly retryAfterSec?: number,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const unauthorized = () => new AppError("UNAUTHORIZED", "Please sign in to continue.", 401);
export const forbidden = (msg = "You do not have access to that.") => new AppError("FORBIDDEN", msg, 403);
export const notFound = (what = "Item") => new AppError("NOT_FOUND", `${what} not found.`, 404);
export const conflict = (msg: string) => new AppError("CONFLICT", msg, 409);
export const invalid = (msg: string, fieldErrors?: Record<string, string[]>) => new AppError("VALIDATION", msg, 422, fieldErrors);
export const rateLimited = (retryAfterSec: number) =>
  new AppError("RATE_LIMITED", `Too many requests. Try again in ${Math.max(1, Math.ceil(retryAfterSec))}s.`, 429, undefined, retryAfterSec);
