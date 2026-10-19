import { requireAdmin } from "@/lib/auth";
import { ClipError, MAX_FILE_BYTES } from "@/lib/clipfile";
import { publishClip } from "@/lib/publish";
import { StorageNotConnected } from "@/lib/store/none";

export const dynamic = "force-dynamic";

/**
 * Admin: publish one clip file (multipart: `file`, optional `package`, and
 * `rights=yes`, the uploader's confirmation that they may publish the audio).
 */
export async function POST(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "Could not read the upload" }, { status: 400 });
  }
  if (form.get("rights") !== "yes") {
    return Response.json(
      { error: "Confirm that you own or may publish this audio" },
      { status: 400 },
    );
  }
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "No file" }, { status: 400 });
  if (file.size > MAX_FILE_BYTES) {
    return Response.json({ error: "The file is too big (5 MB at most)" }, { status: 413 });
  }
  const packageName = form.get("package");
  try {
    const { clip, replaced } = await publishClip(new Uint8Array(await file.arrayBuffer()), {
      packageName: typeof packageName === "string" ? packageName : undefined,
    });
    return Response.json({ clip, replaced });
  } catch (e) {
    if (e instanceof StorageNotConnected) return Response.json({ error: e.message }, { status: 503 });
    if (e instanceof ClipError) return Response.json({ error: e.message }, { status: 422 });
    console.error("upload failed", e);
    return Response.json({ error: "The server could not save the clip" }, { status: 500 });
  }
}
