import { del, get, list, put } from "@vercel/blob";
import { emptyCatalog, type Catalog } from "../catalog";
import type { Store } from "./types";

const CATALOG_KEY = "catalog.json";

/**
 * Vercel Blob. A store is either public (files have their own address) or
 * private (files can only be read with the token, so this server hands them
 * out). Which one it is shows on the first save, so both are supported.
 */
export class BlobStore implements Store {
  readonly mode = "blob" as const;

  /** Learned from the store; "public" until a save says otherwise. */
  access: "public" | "private" = "public";

  constructor(private readonly token: string) {}

  private async putAny(key: string, body: string | Buffer, contentType: string): Promise<string> {
    const options = {
      contentType,
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 60,
      token: this.token,
    } as const;
    try {
      const blob = await put(key, body, { ...options, access: this.access });
      return this.access === "private" ? key : blob.url;
    } catch (e) {
      const text = e instanceof Error ? e.message : "";
      const other = this.access === "public" ? "private" : "public";
      // "Cannot use public access on a private store" and the reverse.
      if (!/private store|public store/i.test(text)) throw e;
      this.access = other;
      const blob = await put(key, body, { ...options, access: other });
      return other === "private" ? key : blob.url;
    }
  }

  async readCatalog(): Promise<Catalog> {
    // A private store answers to the token; a public one does not know it.
    try {
      const found = await get(CATALOG_KEY, { access: "private", token: this.token, useCache: false });
      if (found?.statusCode === 200) {
        this.access = "private";
        return JSON.parse(await new Response(found.stream).text()) as Catalog;
      }
    } catch {
      // not a private store (or not there): try it as a public one
    }
    const { blobs } = await list({ prefix: CATALOG_KEY, limit: 5, token: this.token });
    const found = blobs.find((b) => b.pathname === CATALOG_KEY);
    if (!found) return emptyCatalog();
    // A fresh address each time, so a cached older copy is never served.
    const res = await fetch(`${found.url}?v=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`catalog unreadable (${res.status})`);
    return (await res.json()) as Catalog;
  }

  async writeCatalog(catalog: Catalog) {
    await this.putAny(CATALOG_KEY, JSON.stringify(catalog), "application/json");
  }

  async putFile(key: string, data: Uint8Array, contentType: string) {
    return this.putAny(key, Buffer.from(data), contentType);
  }

  async deleteFiles(addresses: string[]) {
    if (addresses.length === 0) return;
    // Private files are known by their key; del() takes a URL or a pathname.
    await del(addresses, { token: this.token });
  }

  /** A private file's bytes, read from the store. */
  async open(address: string) {
    const found = await get(address, { access: "private", token: this.token, useCache: false });
    if (!found || found.statusCode !== 200) return null;
    const bytes = new Uint8Array(await new Response(found.stream).arrayBuffer());
    return {
      bytes,
      contentType: found.blob.contentType,
      size: found.blob.size,
      debug: {
        metaSize: found.blob.size,
        got: bytes.length,
        type: found.blob.contentType,
        headers: Object.fromEntries(found.headers.entries()),
      },
    };
  }
}
