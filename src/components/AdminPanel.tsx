"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import type { ClipRecord } from "@/lib/catalog";
import { slugify } from "@/lib/slug";
import { formatDuration, formatSize, plural } from "@/lib/format";
import { ClipRow } from "./ClipRow";

type Job = { name: string; state: "waiting" | "sending" | "done" | "failed"; note?: string };

async function call(url: string, init: RequestInit) {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Failed (${res.status})`);
  return body;
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export function AdminPanel({
  clips,
  storage,
}: {
  clips: ClipRecord[];
  storage: "local" | "blob" | "none";
}) {
  const router = useRouter();
  const packages = useMemo(() => {
    const names = new Map<string, string>();
    for (const c of clips) names.set(slugify(c.package), c.package);
    return [...names.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [clips]);

  return (
    <>
      <p className="lead">
        Storage: {storage === "blob" ? "Vercel Blob" : "this PC (local folder, for testing)"} ·{" "}
        {plural(clips.length, "clip")}
        {" · "}
        <button
          className="btn ghost small"
          onClick={async () => {
            await fetch("/api/admin/logout", { method: "POST" });
            router.refresh();
          }}
        >
          Sign out
        </button>
      </p>
      <Uploader packages={packages.map(([, name]) => name)} onDone={() => router.refresh()} />
      <Manager clips={clips} packages={packages} onChange={() => router.refresh()} />
    </>
  );
}

function Uploader({ packages, onDone }: { packages: string[]; onDone: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [hot, setHot] = useState(false);
  const [packageName, setPackageName] = useState("");
  const [rights, setRights] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [busy, setBusy] = useState(false);

  const send = async (files: File[]) => {
    const list = files.filter((f) => f.name.toLowerCase().endsWith(".vasanam"));
    if (list.length === 0) return;
    setBusy(true);
    setJobs(list.map((f) => ({ name: f.name, state: "waiting" })));
    const patch = (i: number, job: Partial<Job>) =>
      setJobs((all) => all.map((j, k) => (k === i ? { ...j, ...job } : j)));
    for (const [i, file] of list.entries()) {
      patch(i, { state: "sending" });
      const form = new FormData();
      form.set("file", file);
      form.set("rights", "yes");
      if (packageName.trim()) form.set("package", packageName.trim());
      try {
        const body = await call("/api/admin/upload", { method: "POST", body: form });
        patch(i, {
          state: "done",
          note: `${body.clip.title} → ${body.clip.package}${body.replaced ? " (replaced)" : ""}`,
        });
      } catch (e) {
        patch(i, { state: "failed", note: e instanceof Error ? e.message : "Failed" });
      }
    }
    setBusy(false);
    onDone();
  };

  return (
    <section className="panel">
      <h2 style={{ marginTop: 0 }}>Upload clips</h2>
      <div className="field">
        <label htmlFor="pkg">Package (leave empty to use the one named in each file)</label>
        <input
          id="pkg"
          type="text"
          list="packages"
          value={packageName}
          maxLength={60}
          onChange={(e) => setPackageName(e.target.value)}
          placeholder="e.g. Chandramukhi"
        />
        <datalist id="packages">
          {packages.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </div>
      <label className="check">
        <input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} />
        <span>I made this audio, or I have the right to publish it here.</span>
      </label>
      <div
        className={`drop ${hot ? "hot" : ""}`}
        onClick={() => rights && input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setHot(true);
        }}
        onDragLeave={() => setHot(false)}
        onDrop={(e) => {
          e.preventDefault();
          setHot(false);
          if (rights && !busy) void send([...e.dataTransfer.files]);
        }}
        role="button"
        aria-disabled={!rights || busy}
      >
        {rights
          ? "Drop .vasanam files here, or click to choose"
          : "Tick the box above to enable uploads"}
      </div>
      <input
        ref={input}
        type="file"
        accept=".vasanam"
        multiple
        hidden
        onChange={(e) => {
          if (rights && !busy && e.target.files) void send([...e.target.files]);
          e.target.value = "";
        }}
      />
      {jobs.length > 0 && (
        <ul className="queue">
          {jobs.map((j, i) => (
            <li key={i} className={j.state === "done" ? "ok" : j.state === "failed" ? "bad" : ""}>
              {j.state === "done" ? "✓" : j.state === "failed" ? "✗" : j.state === "sending" ? "…" : "·"}{" "}
              {j.name}
              {j.note ? ` — ${j.note}` : ""}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Manager({
  clips,
  packages,
  onChange,
}: {
  clips: ClipRecord[];
  packages: [string, string][];
  onChange: () => void;
}) {
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<string | null>(null);

  const run = async (job: () => Promise<unknown>) => {
    setError("");
    try {
      await job();
      onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  };

  if (clips.length === 0) {
    return (
      <section className="panel">
        <div className="empty">No clips yet. Upload the files made by the clip maker.</div>
      </section>
    );
  }

  return (
    <section>
      {error && <p className="err">{error}</p>}
      {packages.map(([slug, name]) => {
        const inPack = clips.filter((c) => slugify(c.package) === slug);
        const total = inPack.reduce((s, c) => s + c.durationMs, 0);
        const size = inPack.reduce((s, c) => s + c.bytes, 0);
        return (
          <div key={slug}>
            <div className="pkg-head">
              <h3>{name}</h3>
              <span className="stats">
                <span>{plural(inPack.length, "clip")}</span>
                <span>{formatDuration(total)}</span>
                <span>{formatSize(size)}</span>
              </span>
              <span className="spacer" />
              <button
                className="btn ghost small"
                onClick={() => {
                  const next = window.prompt("New package name", name);
                  if (next && next.trim() && next.trim() !== name) {
                    void run(() =>
                      call(`/api/admin/packages/${encodeURIComponent(slug)}`, json("PATCH", { name: next })),
                    );
                  }
                }}
              >
                Rename
              </button>
              <button
                className="btn red small"
                onClick={() => {
                  if (window.confirm(`Delete "${name}" and its ${plural(inPack.length, "clip")}?`)) {
                    void run(() =>
                      call(`/api/admin/packages/${encodeURIComponent(slug)}`, { method: "DELETE" }),
                    );
                  }
                }}
              >
                Delete package
              </button>
            </div>
            <div className="list">
              {inPack.map((c) =>
                editing === c.id ? (
                  <EditRow
                    key={c.id}
                    clip={c}
                    packages={packages.map(([, n]) => n)}
                    onCancel={() => setEditing(null)}
                    onSave={(patch) =>
                      run(async () => {
                        await call(`/api/admin/clips/${c.id}`, json("PATCH", patch));
                        setEditing(null);
                      })
                    }
                  />
                ) : (
                  <ClipRow
                    key={c.id}
                    clip={c}
                    showPackage={false}
                    actions={
                      <span className="inline">
                        <button className="btn ghost small" onClick={() => setEditing(c.id)}>
                          Edit
                        </button>
                        <button
                          className="btn red small"
                          onClick={() => {
                            if (window.confirm(`Delete "${c.title}"?`)) {
                              void run(() => call(`/api/admin/clips/${c.id}`, { method: "DELETE" }));
                            }
                          }}
                        >
                          Delete
                        </button>
                      </span>
                    }
                  />
                ),
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}

function EditRow({
  clip,
  packages,
  onSave,
  onCancel,
}: {
  clip: ClipRecord;
  packages: string[];
  onSave: (patch: { title: string; package: string; movie: string; character: string }) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(clip.title);
  const [pack, setPack] = useState(clip.package);
  const [movie, setMovie] = useState(clip.movie ?? "");
  const [character, setCharacter] = useState(clip.character ?? "");
  return (
    <div className="row" style={{ flexDirection: "column", alignItems: "stretch" }}>
      <div className="inline">
        <input type="text" value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
        <input type="text" list="packages-edit" value={pack} maxLength={60} onChange={(e) => setPack(e.target.value)} placeholder="Package" />
        <datalist id="packages-edit">
          {packages.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
        <input type="text" value={movie} maxLength={60} onChange={(e) => setMovie(e.target.value)} placeholder="Movie" />
        <input type="text" value={character} maxLength={60} onChange={(e) => setCharacter(e.target.value)} placeholder="Character" />
      </div>
      <div className="inline">
        <button className="btn small" onClick={() => onSave({ title, package: pack, movie, character })}>
          Save
        </button>
        <button className="btn ghost small" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
