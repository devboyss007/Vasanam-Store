import { LocalStore, SAFE_KEY } from "@/lib/store/local";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Local development only: serves the files kept in the .data folder. */
export async function GET(_req: Request, ctx: { params: Promise<{ key: string[] }> }) {
  const store = getStore();
  if (store.mode !== "local") return new Response("Not found", { status: 404 });
  const key = (await ctx.params).key.join("/");
  if (!SAFE_KEY.test(key) || key.includes("..")) return new Response("Not found", { status: 404 });
  const bytes = await (store as LocalStore).readFile(key);
  if (!bytes) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": key.endsWith(".mp3") ? "audio/mpeg" : "application/octet-stream",
      "Cache-Control": "no-store",
    },
  });
}
