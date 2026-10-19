import { cleanText, parseClipFile } from "./clipfile";
import { upsertClip, type ClipRecord } from "./catalog";
import { getStore, updateCatalog } from "./store";

export type PublishOptions = {
  /** Put the clip in this package instead of the one named in the file. */
  packageName?: string;
};

/**
 * Checks a clip file and publishes it: the .vasanam file, an mp3 for
 * previewing, and the catalog entry. The same clip id replaces the old one.
 */
export async function publishClip(
  bytes: Uint8Array,
  options: PublishOptions = {},
  now = new Date().toISOString(),
): Promise<{ clip: ClipRecord; replaced: boolean }> {
  const parsed = parseClipFile(bytes);
  const store = getStore();
  const fileUrl = await store.putFile(`clips/${parsed.id}.vasanam`, bytes, "application/octet-stream");
  const previewUrl = await store.putFile(`clips/${parsed.id}.mp3`, parsed.originalMp3, "audio/mpeg");
  const packageName = cleanText(options.packageName) || parsed.package;

  return updateCatalog((catalog) => {
    const { catalog: next, clip, replaced } = upsertClip(catalog, {
      id: parsed.id,
      title: parsed.title,
      package: packageName,
      movie: parsed.movie,
      character: parsed.character,
      durationMs: parsed.durationMs,
      bytes: bytes.length,
      verdict: parsed.verdict,
      rights: parsed.rights,
      rightsConfirmedAt: now,
      fileUrl,
      previewUrl,
      now,
    });
    return { catalog: next, result: { clip, replaced } };
  });
}
