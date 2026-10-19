import { createHash } from "node:crypto";
import { zipSync } from "fflate";

const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

/** A 16 kHz mono 16-bit WAV of silence, [ms] long. */
export function silentWav(ms: number): Uint8Array {
  const samples = Math.round((ms / 1000) * 16000);
  const data = samples * 2;
  const out = new Uint8Array(44 + data);
  const v = new DataView(out.buffer);
  const put = (o: number, s: string) => [...s].forEach((ch, i) => (out[o + i] = ch.charCodeAt(0)));
  put(0, "RIFF");
  v.setUint32(4, 36 + data, true);
  put(8, "WAVE");
  put(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, 16000, true);
  v.setUint32(28, 32000, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  put(36, "data");
  v.setUint32(40, data, true);
  return out;
}

export type ClipOptions = {
  id?: string;
  name?: string;
  pack?: string;
  durationMs?: number;
  mp3?: Uint8Array;
  wav?: Uint8Array;
  meta?: Record<string, unknown>;
  extra?: Record<string, Uint8Array>;
  skip?: string[];
};

/** Stand-in mp3: an ID3 tag header and some bytes. */
export function fakeMp3(length = 20000): Uint8Array {
  const b = new Uint8Array(length).fill(7);
  b.set([0x49, 0x44, 0x33, 3, 0]);
  return b;
}

let counter = 0;
export const newId = () => (++counter).toString(16).padStart(32, "0");

/** Builds a clip file the way the PC clip maker does. */
export function makeClip(o: ClipOptions = {}): Uint8Array {
  const durationMs = o.durationMs ?? 8000;
  const mp3 = o.mp3 ?? fakeMp3();
  const wav = o.wav ?? silentWav(durationMs);
  const meta = {
    format: "vasanam-clip",
    version: 1,
    id: o.id ?? newId(),
    name: o.name ?? "A clip",
    package: o.pack ?? "Some Movie",
    durationMs,
    createdAt: "2026-10-13T17:30:00Z",
    rights: "Test clip",
    original: { file: "original.mp3", bytes: mp3.length, sha256: sha(mp3) },
    voice: { file: "voice.wav", bytes: wav.length, sha256: sha(wav), sampleRate: 16000 },
    quality: { verdict: "good", notes: [], metrics: {} },
    ...o.meta,
  };
  const files: Record<string, Uint8Array> = {
    "clip.json": new TextEncoder().encode(JSON.stringify(meta)),
    "original.mp3": mp3,
    "voice.wav": wav,
    ...o.extra,
  };
  for (const s of o.skip ?? []) delete files[s];
  return zipSync(files);
}
