import path from "node:path";
import { LocalStore } from "./local";
import { BlobStore } from "./blob";
import type { Store } from "./types";
import type { Catalog } from "../catalog";

let store: Store | undefined;

/** Vercel Blob when BLOB_READ_WRITE_TOKEN is set, otherwise a local folder. */
export function getStore(): Store {
  if (!store) {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    store = token
      ? new BlobStore(token)
      : new LocalStore(process.env.DATA_DIR ?? path.join(process.cwd(), ".data"));
  }
  return store;
}

/** For tests. */
export function setStore(next: Store | undefined) {
  store = next;
}

// The catalog is one file, so changes to it go through one at a time.
let queue: Promise<unknown> = Promise.resolve();

/** Reads the catalog, lets [change] edit it, writes it back; one at a time. */
export function updateCatalog<T>(
  change: (catalog: Catalog) => Promise<{ catalog: Catalog; result: T }> | { catalog: Catalog; result: T },
): Promise<T> {
  const run = queue.then(async () => {
    const s = getStore();
    const { catalog, result } = await change(await s.readCatalog());
    await s.writeCatalog(catalog);
    return result;
  });
  queue = run.catch(() => undefined);
  return run;
}
