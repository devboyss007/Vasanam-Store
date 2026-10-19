import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { listClips } from "@/lib/catalog";
import { ClipError } from "@/lib/clipfile";
import { publishClip } from "@/lib/publish";
import { getStore, setStore } from "@/lib/store";
import { LocalStore } from "@/lib/store/local";
import { makeClip, newId } from "./fixture";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "vstore-"));
  setStore(new LocalStore(dir));
});

afterEach(async () => {
  setStore(undefined);
  await rm(dir, { recursive: true, force: true });
});

describe("publishClip", () => {
  it("stores the file, the preview and the catalog entry", async () => {
    const bytes = makeClip({ name: "Mass", pack: "Movie A" });
    const { clip, replaced } = await publishClip(bytes);
    expect(replaced).toBe(false);
    expect(clip.bytes).toBe(bytes.length);
    const store = getStore() as LocalStore;
    expect((await store.readFile(`clips/${clip.id}.vasanam`))!.length).toBe(bytes.length);
    expect((await store.readFile(`clips/${clip.id}.mp3`))!.length).toBe(20000);
    expect(listClips(await store.readCatalog()).total).toBe(1);
  });

  it("lets the admin choose the package", async () => {
    const { clip } = await publishClip(makeClip({ pack: "From file" }), { packageName: "  Chosen  " });
    expect(clip.package).toBe("Chosen");
  });

  it("replaces the same clip instead of duplicating it", async () => {
    const id = newId();
    await publishClip(makeClip({ id, name: "One" }));
    const second = await publishClip(makeClip({ id, name: "One, fixed" }));
    expect(second.replaced).toBe(true);
    expect(second.clip.version).toBe(2);
    expect(listClips(await getStore().readCatalog()).total).toBe(1);
  });

  it("saves nothing for a bad file", async () => {
    await expect(publishClip(new Uint8Array(10))).rejects.toBeInstanceOf(ClipError);
    expect(listClips(await getStore().readCatalog()).total).toBe(0);
  });

  it("keeps every clip when many are published at once", async () => {
    await Promise.all(Array.from({ length: 12 }, (_, i) => publishClip(makeClip({ name: `C${i}` }))));
    expect(listClips(await getStore().readCatalog(), { limit: 100 }).total).toBe(12);
  });

  it("refuses unsafe file keys", async () => {
    const store = getStore() as LocalStore;
    await expect(store.putFile("../evil", new Uint8Array(1))).rejects.toThrow();
    await expect(store.putFile("clips/../../x", new Uint8Array(1))).rejects.toThrow();
  });
});
