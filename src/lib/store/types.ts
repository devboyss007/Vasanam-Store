import type { Catalog } from "../catalog";

/** Where the catalog and the clip files live. */
export interface Store {
  /** "local": a folder on this PC (development). "blob": Vercel Blob. */
  readonly mode: "local" | "blob";
  readCatalog(): Promise<Catalog>;
  writeCatalog(catalog: Catalog): Promise<void>;
  /** Saves a file and returns the address people download it from. */
  putFile(key: string, data: Uint8Array, contentType: string): Promise<string>;
  deleteFiles(urls: string[]): Promise<void>;
}
