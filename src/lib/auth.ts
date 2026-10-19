import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/** One admin, one password (ADMIN_PASSWORD). A signed cookie keeps them in. */

export const COOKIE = "vs_admin";
const SESSION_SECONDS = 12 * 3600;

export function adminConfigured(): boolean {
  return !!process.env.ADMIN_PASSWORD && (process.env.SESSION_SECRET ?? "").length >= 16;
}

const digest = (s: string) => createHash("sha256").update(s).digest();

export function passwordMatches(given: string): boolean {
  const want = process.env.ADMIN_PASSWORD;
  if (!want) return false;
  return timingSafeEqual(digest(given), digest(want));
}

const sign = (payload: string) =>
  createHmac("sha256", process.env.SESSION_SECRET ?? "").update(payload).digest("base64url");

export function makeSession(now = Date.now()): string {
  const expires = Math.floor(now / 1000) + SESSION_SECONDS;
  return `${expires}.${sign(String(expires))}`;
}

export function sessionValid(value: string | undefined, now = Date.now()): boolean {
  if (!value || !adminConfigured()) return false;
  const [expires, mac] = value.split(".");
  if (!expires || !mac || !/^\d+$/.test(expires)) return false;
  const want = sign(expires);
  const a = Buffer.from(mac);
  const b = Buffer.from(want);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  return Number(expires) > Math.floor(now / 1000);
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "strict" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_SECONDS,
};

export async function isAdmin(): Promise<boolean> {
  return sessionValid((await cookies()).get(COOKIE)?.value);
}

/** A browser page on another site must not be able to act as the admin. */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // not a browser form post
  try {
    return new URL(origin).host === req.headers.get("host");
  } catch {
    return false;
  }
}

/** null when the caller is the admin, otherwise the response to send back. */
export async function requireAdmin(req: Request): Promise<Response | null> {
  if (!sameOrigin(req)) return Response.json({ error: "Wrong origin" }, { status: 403 });
  if (!(await isAdmin())) return Response.json({ error: "Not signed in" }, { status: 401 });
  return null;
}

// Failed logins per address: slow down guessing.
const failures = new Map<string, { count: number; since: number }>();
const WINDOW_MS = 10 * 60_000;
const MAX_FAILURES = 8;

export function loginBlocked(ip: string, now = Date.now()): boolean {
  const f = failures.get(ip);
  if (!f) return false;
  if (now - f.since > WINDOW_MS) {
    failures.delete(ip);
    return false;
  }
  return f.count >= MAX_FAILURES;
}

export function noteLogin(ip: string, ok: boolean, now = Date.now()) {
  if (ok) {
    failures.delete(ip);
    return;
  }
  const f = failures.get(ip);
  if (!f || now - f.since > WINDOW_MS) failures.set(ip, { count: 1, since: now });
  else f.count++;
}
