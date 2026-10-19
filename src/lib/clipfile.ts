import { createHash } from "node:crypto";
import { unzipSync } from "fflate";

/**
 * Reads one `.vasanam` clip file (see Pesura/docs/CLIP_PACK_FORMAT.md) and
 * enforces the same rules the app enforces when it imports it. The file is
 * untrusted input: only audio and text are read, nothing is ever run.
 */

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_JSON_BYTES = 16 * 1024;
const MAX_AUDIO_BYTES = 2 * 1024 * 1024;
const MIN_MS = 3000;
const MAX_MS = 30000;
const ENTRIES = new Set(["clip.json", "original.mp3", "voice.wav"]);

export class ClipError extends Error {}

export type ParsedClip = {
  id: string;
  title: string;
  package: string;
  movie?: string;
  character?: string;
  durationMs: number;
  createdAt?: string;
  rights?: string;
  verdict?: string;
  originalBytes: number;
  voiceBytes: number;
  /** The mp3 players hear; kept apart so the site can preview it. */
  originalMp3: Uint8Array;
};

// Written with escapes so no line-separator character sits in the source.
const CONTROL = new RegExp("[\u0000-\u001f\u007f-\u009f\u2028\u2029]", "g");

/** Control characters out, spaces collapsed, cut to [max]. */
export function cleanText(value: unknown, max = 60): string {
  if (typeof value !== "string") return "";
  return value
    .replace(CONTROL, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

const sha256 = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");

/** Checks a 16 kHz mono 16-bit PCM WAV and returns its length in ms. */
export function wavDurationMs(wav: Uint8Array): number {
  const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
  const tag = (o: number) =>
    String.fromCharCode(...wav.subarray(o, o + 4));
  if (wav.length < 44 || tag(0) !== "RIFF" || tag(8) !== "WAVE") {
    throw new ClipError("voice.wav is not a WAV file");
  }
  let pos = 12;
  let rate = 0;
  let channels = 0;
  let bits = 0;
  let format = 0;
  while (pos + 8 <= wav.length) {
    const id = tag(pos);
    const size = view.getUint32(pos + 4, true);
    if (id === "fmt ") {
      format = view.getUint16(pos + 8, true);
      channels = view.getUint16(pos + 10, true);
      rate = view.getUint32(pos + 12, true);
      bits = view.getUint16(pos + 22, true);
    } else if (id === "data") {
      if (format !== 1 || channels !== 1 || bits !== 16 || rate !== 16000) {
        throw new ClipError("voice.wav must be 16 kHz mono 16-bit");
      }
      const bytes = Math.min(size, wav.length - pos - 8);
      return Math.round((bytes / (rate * 2)) * 1000);
    }
    pos += 8 + size + (size % 2);
  }
  throw new ClipError("voice.wav has no audio");
}

export function parseClipFile(bytes: Uint8Array): ParsedClip {
  if (bytes.length > MAX_FILE_BYTES) {
    throw new ClipError("The file is too big (5 MB at most)");
  }
  const limits: Record<string, number> = {
    "clip.json": MAX_JSON_BYTES,
    "original.mp3": MAX_AUDIO_BYTES,
    "voice.wav": MAX_AUDIO_BYTES,
  };
  let rejected: string | undefined;
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, {
      // Decided from the zip's directory, before anything is inflated.
      filter: (f) => {
        if (!ENTRIES.has(f.name)) {
          rejected = `Unexpected entry "${f.name.slice(0, 40)}"`;
          return false;
        }
        if (f.originalSize > limits[f.name]) {
          rejected = `${f.name} is too big`;
          return false;
        }
        return true;
      },
    });
  } catch {
    throw new ClipError("This is not a clip file (not a zip)");
  }
  if (rejected) throw new ClipError(rejected);
  for (const name of ENTRIES) {
    if (!files[name]) throw new ClipError(`${name} is missing`);
  }

  let meta: Record<string, any>;
  try {
    meta = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(files["clip.json"]));
  } catch {
    throw new ClipError("clip.json is not valid JSON");
  }
  if (meta === null || typeof meta !== "object" || Array.isArray(meta)) {
    throw new ClipError("clip.json is not valid");
  }
  if (meta.format !== "vasanam-clip" || meta.version !== 1) {
    throw new ClipError("This clip file is not format vasanam-clip version 1");
  }
  if (typeof meta.id !== "string" || !/^[0-9a-f]{32}$/.test(meta.id)) {
    throw new ClipError("The clip id must be 32 hex characters");
  }
  const title = cleanText(meta.name);
  const pack = cleanText(meta.package);
  if (!title) throw new ClipError("The clip has no name");
  if (!pack) throw new ClipError("The clip has no package");

  const durationMs = meta.durationMs;
  if (!Number.isInteger(durationMs) || durationMs < MIN_MS || durationMs > MAX_MS) {
    throw new ClipError("Clips must be 3 to 30 seconds long");
  }

  const original = files["original.mp3"];
  const voice = files["voice.wav"];
  const wantOriginal = meta.original?.sha256;
  const wantVoice = meta.voice?.sha256;
  if (sha256(original) !== wantOriginal || sha256(voice) !== wantVoice) {
    throw new ClipError("The audio does not match its checksum (damaged file)");
  }
  const wavMs = wavDurationMs(voice);
  if (wavMs < MIN_MS - 100 || wavMs > MAX_MS + 500 || Math.abs(wavMs - durationMs) > 1500) {
    throw new ClipError("The voice recording length does not match the clip length");
  }

  const verdict = cleanText(meta.quality?.verdict, 10);
  return {
    id: meta.id,
    title,
    package: pack,
    movie: cleanText(meta.movie) || undefined,
    character: cleanText(meta.character) || undefined,
    durationMs,
    createdAt: typeof meta.createdAt === "string" ? cleanText(meta.createdAt, 40) : undefined,
    rights: cleanText(meta.rights, 200) || undefined,
    verdict: ["good", "check", "poor"].includes(verdict) ? verdict : undefined,
    originalBytes: original.length,
    voiceBytes: voice.length,
    originalMp3: original,
  };
}
