import { summarisePackages } from "@/lib/catalog";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

/** GET /api/packages?q=<text> -> { packages: [{ slug, name, clips, durationMs, bytes }] } */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? undefined;
  const packages = summarisePackages(await getStore().readCatalog(), q);
  return Response.json(
    { packages },
    { headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" } },
  );
}
