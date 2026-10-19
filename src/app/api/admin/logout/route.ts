import { cookies } from "next/headers";
import { COOKIE, sameOrigin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return Response.json({ error: "Wrong origin" }, { status: 403 });
  (await cookies()).delete(COOKIE);
  return Response.json({ ok: true });
}
