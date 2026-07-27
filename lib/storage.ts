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

import { createClient } from "@/lib/supabase/client";

export type UploadKind = "version" | "asset";

const BUCKET = "audio";
const DEFAULT_EXPIRY = 3600;

export function buildStoragePath(params: {
  trackId: string;
  kind: UploadKind;
  entityId: string;
  filename: string;
}): string {
  const { trackId, kind, entityId, filename } = params;
  const folder = kind === "version" ? "versions" : "assets";
  const safe = sanitizeFilename(filename);
  return `tracks/${trackId}/${folder}/${entityId}/${safe}`;
}

export function sanitizeFilename(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "_").trim() || "file";
}

export type UploadOptions = {
  onProgress?: (percent: number) => void;
  contentType?: string;
};

export async function uploadFile(
  path: string,
  file: File | Blob,
  options: UploadOptions = {}
): Promise<{ path: string }> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("You’re signed out — sign in again, then retry the upload.");
  }

  const contentType =
    options.contentType ||
    (file instanceof File && file.type ? file.type : "application/octet-stream");

  if (options.onProgress) {
    await uploadWithProgress(
      path,
      file,
      session.access_token,
      contentType,
      options.onProgress
    );
  } else {
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      upsert: false,
      contentType,
      cacheControl: "3600",
    });
    if (error) throw mapStorageError(error.message);
  }

  return { path };
}

export async function getSignedUrl(
  path: string,
  expiresInSeconds = DEFAULT_EXPIRY
): Promise<string> {
  if (!path) throw new Error("Missing file path.");
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresInSeconds);

  if (error || !data?.signedUrl) {
    throw mapStorageError(error?.message ?? "Could not create a download link.");
  }
  return data.signedUrl;
}

export async function deleteFile(path: string): Promise<void> {
  if (!path || path.startsWith("http://") || path.startsWith("https://")) {
    return;
  }
  const supabase = createClient();
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw mapStorageError(error.message);
}

function uploadWithProgress(
  path: string,
  file: File | Blob,
  accessToken: string,
  contentType: string,
  onProgress: (percent: number) => void
): Promise<void> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!base || !anon) {
    return Promise.reject(
      new Error("Storage isn’t configured — check env vars and try again.")
    );
  }

  const url = `${base}/storage/v1/object/${BUCKET}/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
    xhr.setRequestHeader("apikey", anon);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("cache-control", "3600");

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      const pct = Math.min(99, Math.round((event.loaded / event.total) * 100));
      onProgress(pct);
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
        return;
      }
      let message = `Upload failed (${xhr.status}).`;
      try {
        const body = JSON.parse(xhr.responseText) as { message?: string; error?: string };
        message = body.message || body.error || message;
      } catch {
        /* keep default */
      }
      reject(mapStorageError(message));
    };

    xhr.onerror = () =>
      reject(
        new Error(
          "Upload failed — check your connection, then try again. If it keeps failing, bounce a smaller file."
        )
      );
    xhr.onabort = () => reject(new Error("Upload cancelled."));

    xhr.send(file);
  });
}

function mapStorageError(message: string): Error {
  const lower = message.toLowerCase();
  if (lower.includes("already exists") || lower.includes("duplicate")) {
    return new Error(
      "That file path is already taken — try uploading again (a new version id will be used)."
    );
  }
  if (lower.includes("payload") || lower.includes("too large") || lower.includes("413")) {
    return new Error(
      "Upload failed — file is over the storage limit. Bounce a smaller format or compress the wav."
    );
  }
  if (lower.includes("jwt") || lower.includes("auth") || lower.includes("401")) {
    return new Error("You’re signed out — sign in again, then retry the upload.");
  }
  return new Error(
    message.includes("—")
      ? message
      : `${message} — try again, or pick a different file.`
  );
}
