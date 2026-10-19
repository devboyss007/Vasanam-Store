"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ClipRecord } from "@/lib/catalog";
import { slugify } from "@/lib/slug";
import { formatDuration, formatSize } from "@/lib/format";

// Only one clip plays at a time.
let current: { audio: HTMLAudioElement; stop: () => void } | null = null;

function PlayButton({ id, title }: { id: string; title: string }) {
  const [on, setOn] = useState(false);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);

  useEffect(() => () => audio?.pause(), [audio]);

  const toggle = () => {
    if (audio && on) {
      audio.pause();
      return;
    }
    current?.stop();
    const a = audio ?? new Audio(`/api/clips/${id}/preview`);
    const stop = () => setOn(false);
    a.onended = stop;
    a.onpause = stop;
    a.onerror = stop;
    setAudio(a);
    current = { audio: a, stop };
    a.currentTime = 0;
    a.play().then(() => setOn(true), stop);
  };

  return (
    <button
      type="button"
      className={`play ${on ? "on" : ""}`}
      onClick={toggle}
      aria-label={`${on ? "Pause" : "Play"} ${title}`}
    >
      {on ? "❚❚" : "▶"}
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
      <PlayButton id={clip.id} title={clip.title} />
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
