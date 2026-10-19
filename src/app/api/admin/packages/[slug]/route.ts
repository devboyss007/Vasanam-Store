import { requireAdmin } from "@/lib/auth";
import { cleanText } from "@/lib/clipfile";
import { removeClips, renamePackage, slugify } from "@/lib/catalog";
import { guard } from "@/lib/guard";
import { getStore, updateCatalog } from "@/lib/store";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

/** Admin: rename a package (every clip in it moves to the new name). */
export const PATCH = guard(async (req: Request, ctx: Ctx) => {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const slug = decodeURIComponent((await ctx.params).slug);
  const name = cleanText((await req.json().catch(() => ({}))).name);
  if (!name) return Response.json({ error: "Give the package a name" }, { status: 400 });
  const now = new Date().toISOString();
  const changed = await updateCatalog((catalog) => {
    const r = renamePackage(catalog, slug, name, now);
    return { catalog: r.catalog, result: r.changed };
  });
  return changed > 0
    ? Response.json({ changed })
    : Response.json({ error: "No such package" }, { status: 404 });
});

/** Admin: delete a package with all its clips. */
export const DELETE = guard(async (req: Request, ctx: Ctx) => {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const slug = decodeURIComponent((await ctx.params).slug);
  const removed = await updateCatalog((catalog) => {
    const ids = catalog.clips.filter((c) => slugify(c.package) === slug).map((c) => c.id);
    const r = removeClips(catalog, ids);
    return { catalog: r.catalog, result: r.removed };
  });
  if (removed.length === 0) return Response.json({ error: "No such package" }, { status: 404 });
  await getStore().deleteFiles(removed.flatMap((c) => [c.fileUrl, c.previewUrl]));
  return Response.json({ deleted: removed.length });
});
