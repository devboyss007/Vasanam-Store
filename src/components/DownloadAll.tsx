"use client";

import { useState } from "react";
import { zipSync } from "fflate";
import { formatSize } from "@/lib/format";

/**
 * Downloads every clip of a package as one zip of .vasanam files. The zip is
 * made in the browser from the clips' own files, so the server stays light.
 */
export function DownloadAll({
  name,
  ids,
  bytes,
}: {
  name: string;
  ids: string[];
  bytes: number;
}) {
  const [done, setDone] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = async () => {
    setBusy(true);
    setError("");
    setDone(0);
    try {
      const files: Record<string, Uint8Array> = {};
      for (const id of ids) {
        const res = await fetch(`/api/clips/${id}/file`);
        if (!res.ok) throw new Error(`clip ${id.slice(0, 6)} (${res.status})`);
        files[`${id}.vasanam`] = new Uint8Array(await res.arrayBuffer());
        setDone((n) => n + 1);
      }
      // The clips are already compressed: store them as they are.
      const zip = zipSync(files, { level: 0 });
      const url = URL.createObjectURL(new Blob([zip as BlobPart], { type: "application/zip" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${name.replace(/[\\/:*?"<>|]+/g, " ").trim() || "package"}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      setError(`Download stopped: ${e instanceof Error ? e.message : "unknown error"}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="inline">
      <button className="btn" onClick={run} disabled={busy || ids.length === 0}>
        {busy ? `Downloading ${done}/${ids.length}…` : `Download all (${formatSize(bytes)})`}
      </button>
      {error && <span className="err">{error}</span>}
    </div>
  );
}
