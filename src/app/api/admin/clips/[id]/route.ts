import { requireAdmin } from "@/lib/auth";
import { cleanText } from "@/lib/clipfile";
import { editClip, removeClips } from "@/lib/catalog";
import { getStore, updateCatalog } from "@/lib/store";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Admin: change a clip's title, package, movie or character. */
export async function PATCH(req: Request, ctx: Ctx) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const patch = {
    title: cleanText(body.title) || undefined,
    package: cleanText(body.package) || undefined,
    movie: body.movie === undefined ? undefined : cleanText(body.movie),
    character: body.character === undefined ? undefined : cleanText(body.character),
  };
  const now = new Date().toISOString();
  const clip = await updateCatalog((catalog) => {
    const edited = editClip(catalog, id, patch, now);
    return edited
      ? { catalog: edited.catalog, result: edited.clip }
      : { catalog, result: null };
  });
  return clip ? Response.json({ clip }) : Response.json({ error: "No such clip" }, { status: 404 });
}

/** Admin: delete a clip and its files. */
export async function DELETE(req: Request, ctx: Ctx) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { id } = await ctx.params;
  const removed = await updateCatalog((catalog) => {
    const r = removeClips(catalog, [id]);
    return { catalog: r.catalog, result: r.removed };
  });
  if (removed.length === 0) return Response.json({ error: "No such clip" }, { status: 404 });
  await getStore().deleteFiles(removed.flatMap((c) => [c.fileUrl, c.previewUrl]));
  return Response.json({ ok: true });
}
