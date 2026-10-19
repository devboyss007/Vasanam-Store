import { cookies } from "next/headers";
import {
  COOKIE,
  adminConfigured,
  loginBlocked,
  makeSession,
  noteLogin,
  passwordMatches,
  sameOrigin,
  sessionCookieOptions,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return Response.json({ error: "Wrong origin" }, { status: 403 });
  if (!adminConfigured()) {
    return Response.json(
      { error: "Admin is not set up: set ADMIN_PASSWORD and SESSION_SECRET (16+ characters)." },
      { status: 503 },
    );
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  if (loginBlocked(ip)) {
    return Response.json({ error: "Too many wrong tries. Wait ten minutes." }, { status: 429 });
  }
  let password = "";
  try {
    password = String((await req.json()).password ?? "");
  } catch {
    // an empty password simply fails below
  }
  const ok = passwordMatches(password);
  noteLogin(ip, ok);
  if (!ok) {
    await new Promise((r) => setTimeout(r, 600));
    return Response.json({ error: "Wrong password" }, { status: 401 });
  }
  (await cookies()).set(COOKIE, makeSession(), sessionCookieOptions);
  return Response.json({ ok: true });
}
