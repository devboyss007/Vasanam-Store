/** The catalog: every published clip, grouped into packages by name. */

export type ClipRecord = {
  id: string;
  title: string;
  package: string;
  movie?: string;
  character?: string;
  durationMs: number;
  /** Size of the downloadable .vasanam file. */
  bytes: number;
  verdict?: string;
  rights?: string;
  uploadedAt: string;
  updatedAt: string;
  /** Goes up each time the same clip is uploaded again, so apps can update. */
  version: number;
  /** When the uploader confirmed they may publish this audio. */
  rightsConfirmedAt: string;
  fileUrl: string;
  previewUrl: string;
};

export type Catalog = { version: 1; clips: ClipRecord[] };

export type PackageSummary = {
  slug: string;
  name: string;
  clips: number;
  durationMs: number;
  bytes: number;
  updatedAt: string;
};

export const emptyCatalog = (): Catalog => ({ version: 1, clips: [] });

export const DEFAULT_PAGE = 20;
export const MAX_PAGE = 100;

import { slugify } from "./slug";
export { slugify };

const sortNewest = (a: ClipRecord, b: ClipRecord) =>
  a.uploadedAt < b.uploadedAt ? 1 : a.uploadedAt > b.uploadedAt ? -1 : a.id < b.id ? -1 : 1;

export function encodeCursor(c: ClipRecord): string {
  return Buffer.from(`${c.uploadedAt}|${c.id}`).toString("base64url");
}

function decodeCursor(cursor: string): { at: string; id: string } | null {
  try {
    const [at, id] = Buffer.from(cursor, "base64url").toString().split("|");
    return at && id ? { at, id } : null;
  } catch {
    return null;
  }
}

export type ListQuery = {
  limit?: number;
  cursor?: string;
  packageSlug?: string;
  q?: string;
};

export type ClipPage = { clips: ClipRecord[]; next: string | null; total: number };

/** One page of clips, newest first. [total] counts all matches. */
export function listClips(catalog: Catalog, query: ListQuery = {}): ClipPage {
  const limit = Math.min(MAX_PAGE, Math.max(1, Math.floor(query.limit ?? DEFAULT_PAGE)));
  const q = query.q?.trim().toLowerCase();
  const matches = catalog.clips
    .filter((c) => !query.packageSlug || slugify(c.package) === query.packageSlug)
    .filter(
      (c) =>
        !q ||
        [c.title, c.package, c.movie, c.character].some((t) => t?.toLowerCase().includes(q)),
    )
    .sort(sortNewest);

  let start = 0;
  const cur = query.cursor ? decodeCursor(query.cursor) : null;
  if (cur) {
    start = matches.findIndex(
      (c) => c.uploadedAt < cur.at || (c.uploadedAt === cur.at && c.id > cur.id),
    );
    if (start < 0) start = matches.length;
  }
  const clips = matches.slice(start, start + limit);
  const more = start + limit < matches.length;
  return {
    clips,
    next: more && clips.length > 0 ? encodeCursor(clips[clips.length - 1]) : null,
    total: matches.length,
  };
}

export function summarisePackages(catalog: Catalog, q?: string): PackageSummary[] {
  const groups = new Map<string, ClipRecord[]>();
  for (const c of catalog.clips) {
    const slug = slugify(c.package);
    (groups.get(slug) ?? groups.set(slug, []).get(slug)!).push(c);
  }
  const needle = q?.trim().toLowerCase();
  return [...groups.entries()]
    .map(([slug, clips]) => {
      const latest = [...clips].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))[0];
      return {
        slug,
        name: latest.package,
        clips: clips.length,
        durationMs: clips.reduce((s, c) => s + c.durationMs, 0),
        bytes: clips.reduce((s, c) => s + c.bytes, 0),
        updatedAt: latest.updatedAt,
      };
    })
    .filter((p) => !needle || p.name.toLowerCase().includes(needle))
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export const findClip = (catalog: Catalog, id: string) =>
  catalog.clips.find((c) => c.id === id);

/** Adds the clip, or replaces the one with the same id (version goes up). */
export function upsertClip(
  catalog: Catalog,
  clip: Omit<ClipRecord, "version" | "uploadedAt" | "updatedAt"> & { now: string },
): { catalog: Catalog; clip: ClipRecord; replaced: boolean } {
  const { now, ...rest } = clip;
  const old = findClip(catalog, clip.id);
  const record: ClipRecord = {
    ...rest,
    version: (old?.version ?? 0) + 1,
    uploadedAt: old?.uploadedAt ?? now,
    updatedAt: now,
  };
  const clips = [...catalog.clips.filter((c) => c.id !== clip.id), record];
  return { catalog: { ...catalog, clips }, clip: record, replaced: !!old };
}

export function editClip(
  catalog: Catalog,
  id: string,
  patch: { title?: string; package?: string; movie?: string | null; character?: string | null },
  now: string,
): { catalog: Catalog; clip: ClipRecord } | null {
  const old = findClip(catalog, id);
  if (!old) return null;
  const clip: ClipRecord = { ...old, updatedAt: now };
  if (patch.title) clip.title = patch.title;
  if (patch.package) clip.package = patch.package;
  if (patch.movie !== undefined) clip.movie = patch.movie || undefined;
  if (patch.character !== undefined) clip.character = patch.character || undefined;
  // A change the app should notice.
  clip.version = old.version + 1;
  return {
    catalog: { ...catalog, clips: catalog.clips.map((c) => (c.id === id ? clip : c)) },
    clip,
  };
}

export function removeClips(catalog: Catalog, ids: string[]) {
  const set = new Set(ids);
  return {
    catalog: { ...catalog, clips: catalog.clips.filter((c) => !set.has(c.id)) },
    removed: catalog.clips.filter((c) => set.has(c.id)),
  };
}

export function renamePackage(catalog: Catalog, slug: string, name: string, now: string) {
  let changed = 0;
  const clips = catalog.clips.map((c) => {
    if (slugify(c.package) !== slug) return c;
    changed++;
    return { ...c, package: name, updatedAt: now, version: c.version + 1 };
  });
  return { catalog: { ...catalog, clips }, changed };
}
