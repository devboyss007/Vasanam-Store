import { DEFAULT_PAGE, listClips } from "@/lib/catalog";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * The clip list the app reads, newest first, one page at a time:
 *   GET /api/clips?limit=20&cursor=<next>&package=<slug>&q=<text>
 * -> { clips: [...], next: "<cursor>" | null, total }
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit") ?? DEFAULT_PAGE);
  const page = listClips(await getStore().readCatalog(), {
    limit: Number.isFinite(limit) ? limit : DEFAULT_PAGE,
    cursor: url.searchParams.get("cursor") ?? undefined,
    packageSlug: url.searchParams.get("package") ?? undefined,
    q: url.searchParams.get("q") ?? undefined,
  });
  return Response.json(page, {
    headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" },
  });
}
