// Development helper: signs in as the admin and uploads demo clips so the site
// has something to show (and more than one page of it).
//
//   node scripts/seed-demo.mjs [baseUrl] [count]
//
// The demo clips contain silence, not real audio. Reads ADMIN_PASSWORD from
// .env.local. Only for a local or test deployment.
import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { zipSync } from "fflate";

const base = process.argv[2] ?? "http://localhost:3000";
const count = Number(process.argv[3] ?? 25);

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);

const sha = (b) => createHash("sha256").update(b).digest("hex");

function silentWav(ms) {
  const data = Math.round((ms / 1000) * 16000) * 2;
  const out = Buffer.alloc(44 + data);
  out.write("RIFF", 0);
  out.writeUInt32LE(36 + data, 4);
  out.write("WAVEfmt ", 8);
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20);
  out.writeUInt16LE(1, 22);
  out.writeUInt32LE(16000, 24);
  out.writeUInt32LE(32000, 28);
  out.writeUInt16LE(2, 32);
  out.writeUInt16LE(16, 34);
  out.write("data", 36);
  out.writeUInt32LE(data, 40);
  return new Uint8Array(out);
}

function clip(n, pack) {
  const durationMs = 4000 + (n % 9) * 1100;
  const mp3 = new Uint8Array(30000 + n * 1500).fill(n);
  const wav = silentWav(durationMs);
  const meta = {
    format: "vasanam-clip",
    version: 1,
    id: randomBytes(16).toString("hex"),
    name: `Demo line ${n}`,
    package: pack,
    durationMs,
    createdAt: new Date().toISOString(),
    rights: "Demo data: silence",
    original: { file: "original.mp3", bytes: mp3.length, sha256: sha(mp3) },
    voice: { file: "voice.wav", bytes: wav.length, sha256: sha(wav), sampleRate: 16000 },
    quality: { verdict: "good", notes: [], metrics: {} },
  };
  return zipSync({
    "clip.json": new TextEncoder().encode(JSON.stringify(meta)),
    "original.mp3": mp3,
    "voice.wav": wav,
  });
}

const login = await fetch(`${base}/api/admin/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ password: env.ADMIN_PASSWORD }),
});
if (!login.ok) throw new Error(`login failed: ${login.status} ${await login.text()}`);
const cookie = login.headers.get("set-cookie").split(";")[0];

for (let n = 1; n <= count; n++) {
  const pack = n % 3 === 0 ? "Demo Comedy" : "Demo Movie";
  const form = new FormData();
  form.set("file", new File([clip(n, pack)], `demo-${n}.vasanam`));
  form.set("rights", "yes");
  const res = await fetch(`${base}/api/admin/upload`, { method: "POST", headers: { cookie }, body: form });
  if (!res.ok) throw new Error(`upload ${n} failed: ${res.status} ${await res.text()}`);
}
console.log(`uploaded ${count} demo clips to ${base}`);
