import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

import {
  adminConfigured,
  loginBlocked,
  makeSession,
  noteLogin,
  passwordMatches,
  sameOrigin,
  sessionValid,
} from "@/lib/auth";

beforeEach(() => {
  vi.stubEnv("ADMIN_PASSWORD", "correct horse");
  vi.stubEnv("SESSION_SECRET", "0123456789abcdef0123");
});
afterEach(() => vi.unstubAllEnvs());

describe("admin sign-in", () => {
  it("needs both settings", () => {
    expect(adminConfigured()).toBe(true);
    vi.stubEnv("SESSION_SECRET", "short");
    expect(adminConfigured()).toBe(false);
    vi.stubEnv("SESSION_SECRET", "0123456789abcdef0123");
    vi.stubEnv("ADMIN_PASSWORD", "");
    expect(adminConfigured()).toBe(false);
    expect(passwordMatches("")).toBe(false);
  });

  it("accepts only the right password", () => {
    expect(passwordMatches("correct horse")).toBe(true);
    expect(passwordMatches("correct horsE")).toBe(false);
    expect(passwordMatches("")).toBe(false);
  });

  it("makes sessions that expire and cannot be forged", () => {
    const now = Date.now();
    const s = makeSession(now);
    expect(sessionValid(s, now + 60_000)).toBe(true);
    expect(sessionValid(s, now + 13 * 3600_000)).toBe(false);
    expect(sessionValid(undefined)).toBe(false);
    expect(sessionValid("1999999999.forged")).toBe(false);
    const [exp] = s.split(".");
    expect(sessionValid(`${Number(exp) + 99999}.${s.split(".")[1]}`, now)).toBe(false);
    vi.stubEnv("SESSION_SECRET", "another-secret-value-here");
    expect(sessionValid(s, now)).toBe(false);
  });

  it("blocks an address after repeated wrong passwords", () => {
    const t = 1_000_000;
    for (let i = 0; i < 8; i++) {
      expect(loginBlocked("1.2.3.4", t)).toBe(false);
      noteLogin("1.2.3.4", false, t);
    }
    expect(loginBlocked("1.2.3.4", t)).toBe(true);
    expect(loginBlocked("5.6.7.8", t)).toBe(false);
    expect(loginBlocked("1.2.3.4", t + 11 * 60_000)).toBe(false);
  });

  it("refuses requests that come from another site", () => {
    const req = (origin: string | null) =>
      new Request("http://localhost:3000/api/admin/upload", {
        method: "POST",
        headers: { host: "localhost:3000", ...(origin ? { origin } : {}) },
      });
    expect(sameOrigin(req("http://localhost:3000"))).toBe(true);
    expect(sameOrigin(req(null))).toBe(true);
    expect(sameOrigin(req("https://evil.example"))).toBe(false);
  });
});
