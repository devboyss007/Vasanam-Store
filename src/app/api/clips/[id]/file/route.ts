import { serveClipFile } from "@/lib/serve";

export const dynamic = "force-dynamic";

/** The downloadable .vasanam file of one clip. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return serveClipFile(id, "file", true);
}
