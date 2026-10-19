import { serveClipFile } from "@/lib/serve";

export const dynamic = "force-dynamic";

/** The clip's mp3, for listening on the site. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return serveClipFile(id, "preview", false);
}
