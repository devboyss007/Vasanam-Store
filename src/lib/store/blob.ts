import { del, list, put } from "@vercel/blob";
import { emptyCatalog, type Catalog } from "../catalog";
import type { Store } from "./types";

const CATALOG_KEY = "catalog.json";

/** Vercel Blob: the clips are public files, the catalog is one JSON file. */
export class BlobStore implements Store {
  readonly mode = "blob" as const;

  constructor(private readonly token: string) {}

  async readCatalog(): Promise<Catalog> {
    const { blobs } = await list({ prefix: CATALOG_KEY, limit: 5, token: this.token });
    const found = blobs.find((b) => b.pathname === CATALOG_KEY);
    if (!found) return emptyCatalog();
    // A fresh address each time, so a cached older copy is never served.
    const res = await fetch(`${found.url}?v=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`catalog unreadable (${res.status})`);
    return (await res.json()) as Catalog;
  }

  async writeCatalog(catalog: Catalog) {
    await put(CATALOG_KEY, JSON.stringify(catalog), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 60,
      token: this.token,
    });
  }

  async putFile(key: string, data: Uint8Array, contentType: string) {
    const blob = await put(key, Buffer.from(data), {
      access: "public",
      contentType,
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 60,
      token: this.token,
    });
    return blob.url;
  }

  async deleteFiles(urls: string[]) {
    if (urls.length > 0) await del(urls, { token: this.token });
  }
}
