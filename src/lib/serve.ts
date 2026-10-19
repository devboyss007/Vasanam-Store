import { findClip } from "./catalog";
import { BlobStore } from "./store/blob";
import { LocalStore } from "./store/local";
import { getStore } from "./store";

/**
 * Sends one of a clip's files: the bytes themselves from the local folder or
 * a private Blob store, or a redirect to the file's own address when the Blob
 * store is public.
 */
export async function serveClipFile(id: string, kind: "file" | "preview", download: boolean) {
  if (!/^[0-9a-f]{32}$/.test(id)) return new Response("Not found", { status: 404 });
  const store = getStore();
  const clip = findClip(await store.readCatalog(), id);
  if (!clip) return new Response("Not found", { status: 404 });
  const address = kind === "file" ? clip.fileUrl : clip.previewUrl;

  const headers: Record<string, string> = {
    "Content-Type": kind === "file" ? "application/octet-stream" : "audio/mpeg",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
  };
  if (download) headers["Content-Disposition"] = `attachment; filename="${id}.vasanam"`;

  if (store instanceof BlobStore) {
    // Public store (or a catalog written by one): the file has its own address.
    if (/^https?:\/\//.test(address)) {
      return Response.redirect(download ? `${address}?download=1` : address, 302);
    }
    const file = await store.open(address);
    if (!file) return new Response("Not found", { status: 404 });
    headers["Content-Length"] = String(file.size);
    return new Response(file.stream, { headers });
  }

  const key = address.replace(/^\/api\/files\//, "");
  const bytes = await (store as LocalStore).readFile(key);
  if (!bytes) return new Response("Not found", { status: 404 });
  headers["Content-Length"] = String(bytes.length);
  return new Response(new Uint8Array(bytes), { headers });
}
