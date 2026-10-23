import { env } from "@/env";

type Level = "debug" | "info" | "warn" | "error";
const ORDER: Record<Level | "silent", number> = { debug: 10, info: 20, warn: 30, error: 40, silent: 99 };
const SENSITIVE = /pass(word)?|token|secret|authorization|api[_-]?key|cookie|hash/i;

function threshold(): number {
  const configured = env.LOG_LEVEL ?? (env.NODE_ENV === "test" ? "silent" : env.NODE_ENV === "production" ? "info" : "debug");
  return ORDER[configured];
}

function serializeError(err: unknown) {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, ...(env.NODE_ENV !== "production" ? { stack: err.stack } : {}) };
  }
  return { message: String(err) };
}

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || typeof value !== "object") return value;
  if (value instanceof Error) return serializeError(value);
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, SENSITIVE.test(k) ? "[redacted]" : redact(v, depth + 1)]),
  );
}

export interface Logger {
  debug(msg: string, ctx?: Record<string, unknown>): void;
  info(msg: string, ctx?: Record<string, unknown>): void;
  warn(msg: string, ctx?: Record<string, unknown>): void;
  error(msg: string, ctx?: Record<string, unknown>): void;
  child(bindings: Record<string, unknown>): Logger;
}

function make(bindings: Record<string, unknown>): Logger {
  const emit = (level: Level, msg: string, ctx?: Record<string, unknown>) => {
    if (ORDER[level] < threshold()) return;
    const line = JSON.stringify({ level, time: new Date().toISOString(), msg, ...(redact({ ...bindings, ...ctx }) as object) });
    (level === "error" || level === "warn" ? console.error : console.log)(line);
  };
  return {
    debug: (m, c) => emit("debug", m, c),
    info: (m, c) => emit("info", m, c),
    warn: (m, c) => emit("warn", m, c),
    error: (m, c) => emit("error", m, c),
    child: (b) => make({ ...bindings, ...b }),
  };
}

export const logger = make({ app: "fintrack" });
