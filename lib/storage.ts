/**
 * Storage provider module — all file access goes through here so the
 * provider can be swapped later (Supabase Storage → R2, etc.).
 *
 * Paths:
 *   tracks/{track_id}/versions/{version_id}/{filename}
 *   tracks/{track_id}/assets/{asset_id}/{filename}
 *
 * Playback/download uses signed URLs with 1-hour expiry.
 * Bucket `audio` is private — never make it public.
 */

export type UploadKind = "version" | "asset";

export function buildStoragePath(params: {
  trackId: string;
  kind: UploadKind;
  entityId: string;
  filename: string;
}): string {
  const { trackId, kind, entityId, filename } = params;
  const folder = kind === "version" ? "versions" : "assets";
  return `tracks/${trackId}/${folder}/${entityId}/${filename}`;
}

export async function uploadFile(
  _path: string,
  _file: File | Blob
): Promise<{ path: string }> {
  throw new Error("storage.uploadFile not implemented yet");
}

export async function getSignedUrl(
  _path: string,
  _expiresInSeconds = 3600
): Promise<string> {
  throw new Error("storage.getSignedUrl not implemented yet");
}

export async function deleteFile(_path: string): Promise<void> {
  throw new Error("storage.deleteFile not implemented yet");
}
