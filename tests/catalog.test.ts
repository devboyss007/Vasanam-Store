import { describe, expect, it } from "vitest";
import {
  editClip,
  emptyCatalog,
  listClips,
  removeClips,
  renamePackage,
  slugify,
  summarisePackages,
  upsertClip,
  type Catalog,
  type ClipRecord,
} from "@/lib/catalog";

const base = (n: number, over: Partial<ClipRecord & { now: string }> = {}) => ({
  id: String(n).padStart(32, "0"),
  title: `Clip ${n}`,
  package: "Movie A",
  durationMs: 5000,
  bytes: 1000,
  rightsConfirmedAt: "2026-01-01T00:00:00Z",
  fileUrl: `/f/${n}`,
  previewUrl: `/p/${n}`,
  now: `2026-01-01T00:00:${String(n % 60).padStart(2, "0")}Z`,
  ...over,
});

function build(count: number, pack: (n: number) => string = (n) => (n % 2 ? "Movie A" : "Movie B")): Catalog {
  let c = emptyCatalog();
  for (let n = 1; n <= count; n++) c = upsertClip(c, base(n, { package: pack(n) })).catalog;
  return c;
}

describe("paging", () => {
  it("returns 20 first, then the rest, newest first, with no gaps or repeats", () => {
    const c = build(45);
    const seen: string[] = [];
    let cursor: string | undefined;
    const sizes: number[] = [];
    for (;;) {
      const page = listClips(c, { limit: 20, cursor });
      sizes.push(page.clips.length);
      seen.push(...page.clips.map((x) => x.id));
      expect(page.total).toBe(45);
      if (!page.next) break;
      cursor = page.next;
    }
    expect(sizes).toEqual([20, 20, 5]);
    expect(new Set(seen).size).toBe(45);
    expect(seen[0]).toBe(base(45).id); // newest first
  });

  it("has no next page when everything fits", () => {
    const page = listClips(build(7), { limit: 20 });
    expect(page.clips).toHaveLength(7);
    expect(page.next).toBeNull();
  });

  it("says nothing found for an empty store or no match", () => {
    expect(listClips(emptyCatalog())).toEqual({ clips: [], next: null, total: 0 });
    expect(listClips(build(5), { q: "zzz" }).total).toBe(0);
  });

  it("keeps order stable when clips share a time, and survives a bad cursor", () => {
    let c = emptyCatalog();
    for (let n = 1; n <= 5; n++) c = upsertClip(c, base(n, { now: "2026-01-01T00:00:00Z" })).catalog;
    const first = listClips(c, { limit: 2 });
    const second = listClips(c, { limit: 2, cursor: first.next! });
    const third = listClips(c, { limit: 2, cursor: second.next! });
    expect([...first.clips, ...second.clips, ...third.clips].map((x) => x.id)).toEqual(
      [1, 2, 3, 4, 5].map((n) => base(n).id),
    );
    expect(listClips(c, { cursor: "%%%not-a-cursor" }).clips).toHaveLength(5);
  });

  it("limits the page size", () => {
    expect(listClips(build(150), { limit: 1000 }).clips).toHaveLength(100);
    expect(listClips(build(3), { limit: 0 }).clips).toHaveLength(1);
  });

  it("filters by package and by text", () => {
    const c = build(10);
    expect(listClips(c, { packageSlug: "movie-a" }).total).toBe(5);
    expect(listClips(c, { q: "clip 10" }).total).toBe(1);
    expect(listClips(c, { q: "MOVIE B" }).total).toBe(5);
  });
});

describe("packages", () => {
  it("totals the clips of each package", () => {
    const c = build(6);
    const a = summarisePackages(c).find((p) => p.slug === "movie-a")!;
    expect(a).toMatchObject({ clips: 3, durationMs: 15000, bytes: 3000, name: "Movie A" });
  });

  it("groups names that differ only by case or spacing", () => {
    const c = build(4, (n) => (n % 2 ? "Chandramukhi" : "chandramukhi  "));
    expect(summarisePackages(c)).toHaveLength(1);
  });

  it("keeps Tamil names in the address", () => {
    expect(slugify("சந்திரமுகி படம்")).toBe("சந்திரமுகி-படம்");
    expect(slugify("A/B?C")).toBe("a-b-c");
  });
});

describe("changes", () => {
  it("uploading the same clip again replaces it and raises the version", () => {
    const c = build(3);
    const again = upsertClip(c, base(2, { title: "Better title", now: "2027-01-01T00:00:00Z" }));
    expect(again.replaced).toBe(true);
    expect(again.catalog.clips).toHaveLength(3);
    expect(again.clip.version).toBe(2);
    expect(again.clip.uploadedAt).toBe(c.clips.find((x) => x.id === base(2).id)!.uploadedAt);
  });

  it("edits, moves and removes clips; renames packages", () => {
    const c = build(4);
    const edited = editClip(c, base(1).id, { title: "New", package: "Movie Z" }, "2027-01-01T00:00:00Z")!;
    expect(edited.clip).toMatchObject({ title: "New", package: "Movie Z", version: 2 });
    expect(editClip(c, "nope", {}, "x")).toBeNull();

    const renamed = renamePackage(c, "movie-b", "Movie B2", "2027-01-01T00:00:00Z");
    expect(renamed.changed).toBe(2);

    const removed = removeClips(c, [base(1).id, base(2).id]);
    expect(removed.catalog.clips).toHaveLength(2);
    expect(removed.removed).toHaveLength(2);
  });
});
