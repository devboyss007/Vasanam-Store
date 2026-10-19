import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipList } from "@/components/ClipList";
import { DownloadAll } from "@/components/DownloadAll";
import { listClips, slugify, summarisePackages } from "@/lib/catalog";
import { formatDuration, formatSize, plural } from "@/lib/format";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function PackagePage({ params }: { params: Promise<{ slug: string }> }) {
  const slug = slugify(decodeURIComponent((await params).slug));
  const catalog = await getStore().readCatalog();
  const pack = summarisePackages(catalog).find((p) => p.slug === slug);
  if (!pack) notFound();

  const first = listClips(catalog, { limit: 20, packageSlug: slug });
  const ids = catalog.clips.filter((c) => slugify(c.package) === slug).map((c) => c.id);

  return (
    <main>
      <p style={{ marginBottom: 0 }}>
        <Link href="/">← All clips</Link>
      </p>
      <h1>{pack.name}</h1>
      <div className="stats" style={{ marginBottom: 14 }}>
        <span>{plural(pack.clips, "clip")}</span>
        <span>{formatDuration(pack.durationMs)} in total</span>
        <span>{formatSize(pack.bytes)}</span>
      </div>
      <DownloadAll name={pack.name} ids={ids} bytes={pack.bytes} />
      <h2>Clips</h2>
      <ClipList first={first} packageSlug={slug} showPackage={false} />
    </main>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const slug = slugify(decodeURIComponent((await params).slug));
  const pack = summarisePackages(await getStore().readCatalog()).find((p) => p.slug === slug);
  return { title: pack?.name ?? "Package" };
}
