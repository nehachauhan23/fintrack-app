import type { ErrorCode } from "./errors";

export interface ActionError {
  code: ErrorCode;
  message: string;
  fieldErrors?: Record<string, string[]>;
}

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: ActionError };

export const ok = <T,>(data: T): ActionResult<T> => ({ ok: true, data });
