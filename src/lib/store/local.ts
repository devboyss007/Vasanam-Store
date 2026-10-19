import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { emptyCatalog, type Catalog } from "../catalog";
import type { Store } from "./types";

/** Keys look like `clips/<id>.vasanam`: letters, digits, dash, underscore, dot. */
export const SAFE_KEY = /^[a-z0-9_-]+\/[a-z0-9_.-]+$/i;

export class LocalStore implements Store {
  readonly mode = "local" as const;

  constructor(private readonly dir: string) {}

  private file(key: string) {
    if (!SAFE_KEY.test(key) || key.includes("..")) throw new Error("bad key");
    return path.join(this.dir, "files", key);
  }

  async readCatalog(): Promise<Catalog> {
    try {
      return JSON.parse(await readFile(path.join(this.dir, "catalog.json"), "utf8"));
    } catch (e: any) {
      if (e?.code === "ENOENT") return emptyCatalog();
      throw e;
    }
  }

  async writeCatalog(catalog: Catalog) {
    await mkdir(this.dir, { recursive: true });
    const target = path.join(this.dir, "catalog.json");
    const temp = `${target}.tmp`;
    await writeFile(temp, JSON.stringify(catalog, null, 2));
    await rename(temp, target);
  }

  async putFile(key: string, data: Uint8Array) {
    const target = this.file(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, data);
    return `/api/files/${key}`;
  }

  async deleteFiles(urls: string[]) {
    for (const url of urls) {
      const key = url.replace(/^\/api\/files\//, "");
      await rm(this.file(key), { force: true });
    }
  }

  async readFile(key: string): Promise<Buffer | null> {
    try {
      return await readFile(this.file(key));
    } catch (e: any) {
      if (e?.code === "ENOENT") return null;
      throw e;
    }
  }
}
