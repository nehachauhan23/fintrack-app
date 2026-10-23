import { createHash, randomBytes } from "node:crypto";

/** 256 bits of entropy; the raw value only ever lives in the user's cookie. */
export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Only this hash is stored, so a database leak does not yield usable sessions. */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
