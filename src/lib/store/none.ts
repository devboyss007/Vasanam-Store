import { emptyCatalog, type Catalog } from "../catalog";
import type { Store } from "./types";

/** Thrown when something is saved but no storage is connected. */
export class StorageNotConnected extends Error {
  constructor() {
    super(
      "Storage is not connected. In Vercel, open the project's Storage tab, create or connect a Blob store, then redeploy.",
    );
  }
}

/**
 * Used on Vercel when no Blob store is connected: the site still opens and
 * shows no clips, and anything that would save explains what is missing.
 */
export class NoStore implements Store {
  readonly mode = "none" as const;

  async readCatalog(): Promise<Catalog> {
    return emptyCatalog();
  }
  async writeCatalog(): Promise<void> {
    throw new StorageNotConnected();
  }
  async putFile(): Promise<string> {
    throw new StorageNotConnected();
  }
  async deleteFiles(): Promise<void> {
    throw new StorageNotConnected();
  }
}
