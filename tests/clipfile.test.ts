import { describe, expect, it } from "vitest";
import { zipSync } from "fflate";
import { ClipError, cleanText, parseClipFile } from "@/lib/clipfile";
import { makeClip, newId, silentWav } from "./fixture";

const rejects = (bytes: Uint8Array, message: RegExp) => {
  expect(() => parseClipFile(bytes)).toThrow(ClipError);
  expect(() => parseClipFile(bytes)).toThrow(message);
};

describe("parseClipFile", () => {
  it("reads a good clip", () => {
    const id = newId();
    const clip = parseClipFile(makeClip({ id, name: "  Mass   dialogue ", pack: "Movie A", durationMs: 8088 }));
    expect(clip).toMatchObject({
      id,
      title: "Mass dialogue",
      package: "Movie A",
      durationMs: 8088,
      verdict: "good",
    });
    expect(clip.originalMp3.length).toBe(20000);
  });

  it("refuses something that is not a zip", () => {
    rejects(new TextEncoder().encode("hello"), /not a zip/);
  });

  it("refuses a different format or version", () => {
    rejects(makeClip({ meta: { format: "other" } }), /vasanam-clip/);
    rejects(makeClip({ meta: { version: 2 } }), /vasanam-clip/);
  });

  it("refuses extra, nested or missing entries", () => {
    rejects(makeClip({ extra: { "evil.sh": new Uint8Array(3) } }), /Unexpected entry/);
    rejects(makeClip({ extra: { "../x": new Uint8Array(3) } }), /Unexpected entry/);
    rejects(makeClip({ skip: ["voice.wav"] }), /voice\.wav is missing/);
  });

  it("refuses a bad id, no name, no package", () => {
    rejects(makeClip({ id: "short" }), /32 hex/);
    rejects(makeClip({ name: "   " }), /no name/);
    rejects(makeClip({ pack: "" }), /no package/);
  });

  it("keeps clips between 3 and 30 seconds", () => {
    rejects(makeClip({ durationMs: 2000 }), /3 to 30/);
    rejects(makeClip({ durationMs: 31000 }), /3 to 30/);
  });

  it("refuses audio that does not match its checksum", () => {
    const good = makeClip();
    const bad = makeClip({ meta: { original: { sha256: "0".repeat(64) } } });
    expect(() => parseClipFile(good)).not.toThrow();
    rejects(bad, /checksum/);
  });

  it("refuses a voice recording of the wrong length or format", () => {
    rejects(makeClip({ durationMs: 8000, wav: silentWav(12000) }), /does not match/);
    const wav = silentWav(8000);
    new DataView(wav.buffer).setUint32(24, 44100, true); // wrong sample rate
    rejects(makeClip({ wav }), /16 kHz/);
    rejects(makeClip({ wav: new Uint8Array(100) }), /not a WAV/);
  });

  it("refuses oversized parts before inflating them", () => {
    const huge = new Uint8Array(2 * 1024 * 1024 + 10);
    rejects(makeClip({ mp3: huge }), /too big/);
  });

  it("refuses a clip.json that is not JSON", () => {
    const zip = zipSync({
      "clip.json": new TextEncoder().encode("{nope"),
      "original.mp3": new Uint8Array(3),
      "voice.wav": new Uint8Array(3),
    });
    rejects(zip, /not valid JSON/);
  });
});

describe("cleanText", () => {
  it("removes control characters and cuts the length", () => {
    expect(cleanText("a\u0000b\nc\t d")).toBe("a b c d");
    expect(cleanText("x".repeat(100))).toHaveLength(60);
    expect(cleanText(42)).toBe("");
    expect(cleanText("வசனம்  ஒன்று")).toBe("வசனம் ஒன்று");
  });
});
