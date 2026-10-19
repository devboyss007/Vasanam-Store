# Vasanam Clip Store

A small website (Next.js) where the clips for the Vasanam game are published and
downloaded.

- **Upload** the `.vasanam` files made by the PC clip maker (`Pesura/tool/clipmaker`).
- **Packages**: every clip belongs to a package (a movie or any group). Choose the
  package when uploading, or leave it empty to use the one named in each file.
- **Browse and download**: a whole package as one zip, or single clips. Every clip
  and package shows its length and size.
- **The app reads the same data** through a small API (below), 20 clips at a time.

Only clips you made, or may publish, belong here. The upload form asks you to
confirm that for every upload, and the confirmation time is kept with the clip.

## Run it on this PC

```bash
npm install
cp .env.example .env.local     # then fill in ADMIN_PASSWORD and SESSION_SECRET
npm run dev                    # http://localhost:3000
```

`/admin` needs `ADMIN_PASSWORD` (the password) and `SESSION_SECRET` (any long random
text, 16+ characters). Without a Blob token everything is kept in the `.data` folder,
which is not committed. To fill a test site with demo clips (silence, not real
audio): `node scripts/seed-demo.mjs http://localhost:3000 25`.

```bash
npm test          # unit tests
npm run typecheck
npm run build
```

## Put it on Vercel

1. Push this folder to a Git repository and import it in Vercel.
2. In the project: **Storage → Create → Blob**, and connect it to the project. That
   adds `BLOB_READ_WRITE_TOKEN`.
3. Add `ADMIN_PASSWORD` and `SESSION_SECRET` under **Settings → Environment Variables**.
4. Deploy, open `/admin`, sign in, upload.

Notes:

- Clip files are public files on Vercel Blob; the catalog is one `catalog.json` there.
  Changes to the catalog go through one at a time.
- Vercel limits a request body to 4.5 MB. A clip file is far smaller (a 30 second clip
  is about 1.5 MB); the site refuses files over 5 MB.
- The Vercel Hobby plan is for non-commercial use. Move to a paid plan before the
  store is part of a product people pay for.
- "Download all" builds the zip in the visitor's browser from the clips' own files,
  so the server does no heavy work.

## What a clip file must be

Exactly the format in `Pesura/docs/CLIP_PACK_FORMAT.md`. The server checks every rule
the app checks when it imports (three entries only, sizes, 3 to 30 seconds, matching
SHA-256, 16 kHz mono WAV). A bad file is refused with the reason and nothing is saved.
Uploading the same clip again (same id) replaces it and raises its `version`.

## API for the app

All responses are JSON and allow any origin (read only).

`GET /api/clips?limit=20&cursor=<next>&package=<slug>&q=<text>`

```json
{
  "clips": [
    {
      "id": "32 hex characters",
      "title": "Clip name",
      "package": "Package name",
      "movie": "optional",
      "character": "optional",
      "durationMs": 8088,
      "bytes": 412345,
      "verdict": "good",
      "version": 1,
      "uploadedAt": "2026-10-19T12:13:24.773Z",
      "updatedAt": "2026-10-19T12:13:24.773Z"
    }
  ],
  "next": "<cursor, or null on the last page>",
  "total": 25
}
```

Newest first. `limit` is 1 to 100 (default 20). Pass `next` back as `cursor` for the
following page. An empty store gives `{"clips":[],"next":null,"total":0}`.

`GET /api/packages` returns `{ "packages": [{ slug, name, clips, durationMs, bytes, updatedAt }] }`.

`GET /api/clips/<id>/file` downloads the `.vasanam` file (save it, then import it the
way the app imports files from My clips). `GET /api/clips/<id>/preview` is the mp3.

## Admin

`/admin` (signed in): upload several files at once, edit a clip's title, package,
movie or character, delete a clip, rename or delete a whole package.

Security: a signed, HTTP-only, same-site cookie (12 hours); admin calls check that they
come from this site; wrong passwords are slowed down and blocked per address after
eight tries in ten minutes; nothing from an uploaded file is ever executed.

## Layout

```
src/lib/clipfile.ts    reads and checks one .vasanam file
src/lib/catalog.ts     packages, paging, edits (pure functions)
src/lib/store/         local folder and Vercel Blob storage
src/lib/publish.ts     check, store, add to the catalog
src/lib/auth.ts        admin sign-in
src/app/               pages and API routes
src/components/        clip rows, "load more" list, download all, admin
tests/                 unit tests
```
