import Link from "next/link";
import { ClipList } from "@/components/ClipList";
import { listClips, summarisePackages } from "@/lib/catalog";
import { formatDuration, formatSize, plural } from "@/lib/format";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const q = ((await searchParams).q ?? "").trim().slice(0, 80);
  const catalog = await getStore().readCatalog();
  const packages = summarisePackages(catalog, q);
  const first = listClips(catalog, { limit: 20, q });

  return (
    <main>
      <h1>Clips</h1>
      <p className="lead">
        {plural(catalog.clips.length, "clip")} in {plural(summarisePackages(catalog).length, "package")}.
        Download a whole package, or pick single clips.
      </p>

      <form className="search" action="/" role="search" style={{ marginTop: 14 }}>
        <input type="search" name="q" defaultValue={q} placeholder="Search clips and packages" />
        <button className="btn" type="submit">
          Search
        </button>
        {q && (
          <Link className="btn ghost" href="/">
            Clear
          </Link>
        )}
      </form>

      {packages.length > 0 && (
        <>
          <h2>Packages</h2>
          <div className="grid">
            {packages.map((p) => (
              <Link key={p.slug} className="card" href={`/p/${encodeURIComponent(p.slug)}`}>
                <h3>{p.name}</h3>
                <div className="stats">
                  <span>{plural(p.clips, "clip")}</span>
                  <span>{formatDuration(p.durationMs)}</span>
                  <span>{formatSize(p.bytes)}</span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      <h2>{q ? `Clips matching “${q}”` : "All clips"}</h2>
      <ClipList key={q} first={first} q={q || undefined} />
    </main>
  );
}
