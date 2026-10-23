import bcrypt from "bcryptjs";
import { z } from "zod";

const COST = 12;
let dummyHash: Promise<string> | undefined;

export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters.")
  .refine((p) => Buffer.byteLength(p, "utf8") <= 72, "Use at most 72 bytes (bcrypt limit).")
  .refine((p) => new Set(p).size >= 4, "Use a less repetitive password.");

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, COST);
}

/** Hashes created with a lower cost (or another variant) are upgraded transparently on the next successful login. */
export function needsRehash(hash: string): boolean {
  const m = /^\$2[aby]\$(\d{2})\$/.exec(hash);
  return !m || Number(m[1]) < COST;
}

export async function verifyPassword(password: string, hash: string): Promise<{ valid: boolean; needsRehash: boolean }> {
  const valid = await bcrypt.compare(password, hash);
  return { valid, needsRehash: valid && needsRehash(hash) };
}

/** Spends the same time as a real check so response timing does not reveal which emails exist. */
export async function burnPasswordCheck(password: string): Promise<void> {
  dummyHash ??= bcrypt.hash("fintrack-timing-equaliser", COST);
  await bcrypt.compare(password, await dummyHash);
}
