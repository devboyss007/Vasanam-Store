"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ClipRecord } from "@/lib/catalog";
import { slugify } from "@/lib/slug";
import { formatDuration, formatSize } from "@/lib/format";

// Only one clip plays at a time.
let current: { stop: () => void } | null = null;

type Status = "idle" | "loading" | "playing" | "failed";

/** Listen to the whole clip before downloading it. */
function PreviewButton({ id, title }: { id: string; title: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const audio = useRef<HTMLAudioElement | null>(null);

  const stop = () => {
    audio.current?.pause();
    setStatus("idle");
  };

  useEffect(
    () => () => {
      audio.current?.pause();
      if (current && audio.current) current = null;
    },
    [],
  );

  const toggle = () => {
    if (status === "loading" || status === "playing") {
      stop();
      return;
    }
    current?.stop();
    const a = audio.current ?? new Audio(`/api/clips/${id}/preview`);
    audio.current = a;
    a.onended = () => setStatus("idle");
    a.onerror = () => setStatus("failed");
    a.onplaying = () => setStatus("playing");
    current = { stop };
    a.currentTime = 0;
    setStatus("loading");
    a.play().catch(() => setStatus("failed"));
  };

  const label =
    status === "playing" || status === "loading"
      ? "Stop"
      : status === "failed"
        ? "Try again"
        : "Listen";
  return (
    <button
      type="button"
      className={`listen ${status === "playing" || status === "loading" ? "on" : ""} ${status === "failed" ? "bad" : ""}`}
      onClick={toggle}
      aria-label={`${label}: ${title}`}
      title={status === "failed" ? "The preview could not play" : "Listen to the whole clip before downloading"}
    >
      <span aria-hidden="true">{status === "loading" ? "…" : status === "playing" ? "■" : "▶"}</span>
      {label}
    </button>
  );
}

export function ClipRow({
  clip,
  showPackage = true,
  actions,
}: {
  clip: ClipRecord;
  showPackage?: boolean;
  actions?: React.ReactNode;
}) {
  return (
    <div className="row">
      <PreviewButton id={clip.id} title={clip.title} />
      <div className="info">
        <div className="title">{clip.title}</div>
        <div className="meta">
          {showPackage && (
            <Link href={`/p/${encodeURIComponent(slugify(clip.package))}`} className="chip">
              {clip.package}
            </Link>
          )}
          <span>{formatDuration(clip.durationMs)}</span>
          <span>{formatSize(clip.bytes)}</span>
          {clip.character && <span>{clip.character}</span>}
          {clip.verdict && clip.verdict !== "good" && (
            <span className={`chip ${clip.verdict === "poor" ? "poor" : ""}`}>{clip.verdict}</span>
          )}
        </div>
      </div>
      {actions ?? (
        <a className="btn small" href={`/api/clips/${clip.id}/file`} download>
          Download
        </a>
      )}
    </div>
  );
}
