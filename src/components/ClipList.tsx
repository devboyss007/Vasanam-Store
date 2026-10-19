"use client";

import { useState } from "react";
import type { ClipPage, ClipRecord } from "@/lib/catalog";
import { ClipRow } from "./ClipRow";

/**
 * The clips of a search or a package. The first page comes with the page;
 * "Load more" (or scrolling to the end) fetches the next 20, so the whole
 * catalog is never loaded at once.
 */
export function ClipList({
  first,
  packageSlug,
  q,
  showPackage = true,
}: {
  first: ClipPage;
  packageSlug?: string;
  q?: string;
  showPackage?: boolean;
}) {
  const [clips, setClips] = useState<ClipRecord[]>(first.clips);
  const [next, setNext] = useState<string | null>(first.next);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const more = async () => {
    if (!next || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      const params = new URLSearchParams({ limit: "20", cursor: next });
      if (packageSlug) params.set("package", packageSlug);
      if (q) params.set("q", q);
      const res = await fetch(`/api/clips?${params}`);
      if (!res.ok) throw new Error(String(res.status));
      const page: ClipPage = await res.json();
      setClips((old) => [...old, ...page.clips.filter((c) => !old.some((o) => o.id === c.id))]);
      setNext(page.next);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  if (clips.length === 0) return <div className="empty">No clips found</div>;
  return (
    <>
      <div className="list">
        {clips.map((c) => (
          <ClipRow key={c.id} clip={c} showPackage={showPackage} />
        ))}
      </div>
      {failed && <p className="err">Could not load more. Try again.</p>}
      {next && (
        <div className="more">
          <button className="btn ghost" onClick={more} disabled={busy}>
            {busy ? "Loading…" : `Load more (${first.total - clips.length} left)`}
          </button>
        </div>
      )}
    </>
  );
}
