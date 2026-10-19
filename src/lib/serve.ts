import { findClip } from "./catalog";
import { LocalStore } from "./store/local";
import { getStore } from "./store";

/**
 * Sends one of a clip's files: a redirect to the file's own address on Vercel
 * Blob, or the bytes themselves from the local folder.
 */
export async function serveClipFile(id: string, kind: "file" | "preview", download: boolean) {
  if (!/^[0-9a-f]{32}$/.test(id)) return new Response("Not found", { status: 404 });
  const store = getStore();
  const clip = findClip(await store.readCatalog(), id);
  if (!clip) return new Response("Not found", { status: 404 });
  const address = kind === "file" ? clip.fileUrl : clip.previewUrl;

  if (store.mode === "blob") {
    return Response.redirect(download ? `${address}?download=1` : address, 302);
  }
  const key = address.replace(/^\/api\/files\//, "");
  const bytes = await (store as LocalStore).readFile(key);
  if (!bytes) return new Response("Not found", { status: 404 });
  const headers: Record<string, string> = {
    "Content-Type": kind === "file" ? "application/octet-stream" : "audio/mpeg",
    "Content-Length": String(bytes.length),
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
  };
  if (download) headers["Content-Disposition"] = `attachment; filename="${id}.vasanam"`;
  return new Response(new Uint8Array(bytes), { headers });
}
