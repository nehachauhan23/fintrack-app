import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
// import { redirect } from "next/navigation";
const JWT_SECRET = process.env.JWT_SECRET || "SOMERANDOMSTRING";
const COOKIE_NAME = "fintrack_token";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

// ── Password helpers ────────────────────────────────────────────
export async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

// ── JWT helpers ─────────────────────────────────────────────────


const secret = new TextEncoder().encode(JWT_SECRET);

export async function signToken(payload) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(secret);
}
export async function verifyToken(token) {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch {
    return null;
  }
}

// ── Cookie helpers (server-only) ────────────────────────────────
export async function setAuthCookie(token) {
  const cookieStore = await cookies();
  
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "development",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
  console.log("Cookie is set");
  
}

export async function clearAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getTokenFromCookie() {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value ?? null;
}

// ── Get current session user (server-side) ───────────────────────
// Returns { id, email, name } or null
export async function getSession() {
  const token = await getTokenFromCookie();
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) return null;
  return payload;
}

// ── Require auth — throws if unauthenticated ─────────────────────
export async function requireAuth() {
  const session = await getSession();

  if (!session) {
  return [];
}
  return session;
}
