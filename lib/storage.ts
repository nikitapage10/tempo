/**
 * Storage provider module — all file access goes through here so the
 * provider can be swapped later (Supabase Storage → R2, etc.).
 *
 * Paths:
 *   tracks/{track_id}/versions/{version_id}/{filename}
 *   tracks/{track_id}/assets/{asset_id}/{filename}
 *   imports/{import_id}/{source_id}/{filename}   (Import Studio source material)
 *
 * Playback/download uses signed URLs with 1-hour expiry.
 * Bucket `audio` is private — never make it public.
 */

import { createClient } from "@/lib/supabase/client";
import { losslessVaultSiblings } from "@/lib/audio-convert";
import {
  isDesktopApp,
  vaultHas,
  vaultRemove,
  vaultResolveUrl,
  vaultStat,
  vaultWrite,
} from "@/lib/desktop/bridge";

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

/**
 * Import Studio source material. Lives in the same private bucket, under its own
 * prefix, and is deleted once the import is committed or cancelled — it's raw
 * material the artist handed over, not part of their catalog.
 */
export function buildImportSourcePath(params: {
  importId: string;
  sourceId: string;
  filename: string;
}): string {
  const { importId, sourceId, filename } = params;
  return `imports/${importId}/${sourceId}/${sanitizeFilename(filename)}`;
}

/** Artist logo / emblem / banner images — same private bucket, own prefix. */
export function buildArtistAssetPath(params: {
  artistId: string;
  kind: "logo" | "emblem" | "banner";
  filename: string;
}): string {
  const { artistId, kind, filename } = params;
  return `artists/${artistId}/${kind}/${sanitizeFilename(filename)}`;
}

/** Social post image attachments — private bucket, path stored in posts.media. */
export function buildPostMediaPath(params: {
  profileId: string;
  postId: string;
  filename: string;
}): string {
  const { profileId, postId, filename } = params;
  return `profiles/${profileId}/posts/${postId}/${sanitizeFilename(filename)}`;
}

/** Private direct/support/Scene message attachments. Access is signed by a guarded API. */
export function buildMessageMediaPath(params: {
  userId: string;
  scope: "direct" | "support" | "scene";
  threadId: string;
  attachmentId: string;
  filename: string;
}): string {
  const { userId, scope, threadId, attachmentId, filename } = params;
  return `messages/${userId}/${scope}/${threadId}/${attachmentId}/${sanitizeFilename(filename)}`;
}

/**
 * Scene banner/emblem/post media — same private bucket, own prefix. Media a
 * non-uploader must read (a member viewing another member's post image) goes
 * through app/api/scenes/media/url, not this path directly, since storage
 * policies gate on owner = auth.uid().
 */
export function buildSceneMediaPath(params: {
  sceneId: string;
  kind: "banner" | "emblem" | "post";
  entityId: string;
  filename: string;
}): string {
  const { sceneId, kind, entityId, filename } = params;
  return `scenes/${sceneId}/${kind}/${entityId}/${sanitizeFilename(filename)}`;
}

export function sanitizeFilename(name: string): string {
  const trimmed = name.trim() || "file";
  const lastDot = trimmed.lastIndexOf(".");
  const base = lastDot > 0 ? trimmed.slice(0, lastDot) : trimmed;
  const ext = lastDot > 0 ? trimmed.slice(lastDot) : "";
  const safeBase = base
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 120);
  const safeExt = ext.replace(/[^\w.]/g, "").slice(0, 16);
  return `${safeBase || "file"}${safeExt}`;
}

export type UploadOptions = {
  onProgress?: (percent: number) => void;
  contentType?: string;
  signal?: AbortSignal;
  /** Skip the vault write (cloud-only upload — desktop keeps a sibling original). */
  skipVault?: boolean;
};

export async function uploadFile(
  path: string,
  file: File | Blob,
  options: UploadOptions = {}
): Promise<{ path: string; vault: { checksum: string; size: number } | null }> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("You’re signed out — sign in again, then retry the upload.");
  }

  // Desktop: land the bytes in the local vault first, per
  // planning/desktop/02-TECHNICAL-AND-DATA-DESIGN.md §3 — a network failure
  // on the cloud upload below no longer loses the artist's bounce, since
  // it's already on disk and the cloud step can simply be retried. Best
  // effort: a vault write failure (disk full, folder missing) doesn't block
  // the cloud upload, which remains the system of record either way. The
  // caller uses the returned checksum to confirm a local copy with the
  // server (see lib/api/versions.ts), which is what makes cloud eviction safe.
  // skipVault is for desktop lossless uploads that already wrote the original
  // beside the cloud mp3 path before calling here.
  let vault: { checksum: string; size: number } | null = null;
  if (isDesktopApp() && !options.skipVault) {
    try {
      const bytes = await file.arrayBuffer();
      vault = await vaultWrite(path, bytes);
    } catch (err) {
      console.error("[storage] vault write failed, continuing with cloud upload", err);
    }
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
      options.onProgress,
      options.signal
    );
  } else {
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      upsert: false,
      contentType,
      cacheControl: "3600",
    });
    if (error) throw mapStorageError(error.message);
  }

  return { path, vault };
}

/**
 * Reuse the same signed URL until near expiry so <img>/audio keep a stable
 * src and the browser can hit its HTTP cache across soft nav and refreshes.
 * sessionStorage survives full page reloads in the same tab; memory covers
 * remounts within the SPA. Refresh ~10 minutes before the 1h token dies.
 */
type SignedUrlEntry = { url: string; expiresAt: number };

const SIGNED_URL_REFRESH_BUFFER_MS = 10 * 60 * 1000;
const SIGNED_URL_SESSION_KEY = "tempo:signed-url-cache:v1";

const signedUrlMemory = new Map<string, SignedUrlEntry>();
const signedUrlInflight = new Map<string, Promise<string>>();

function signedUrlCacheKey(path: string, expiresInSeconds: number): string {
  return `${expiresInSeconds}:${path}`;
}

// Desktop only: a cloud-served file gets mirrored into the local vault the
// first time it's read, so the next read is a vault hit instead of another
// network round trip. One attempt per path per session — a failure here
// (offline mid-fetch, disk full) just means next session tries again; it
// never blocks the caller, who already has their signed URL.
const mirrorAttempted = new Set<string>();

async function fetchAndWriteVault(
  path: string,
  signedUrl: string
): Promise<{ checksum: string; size: number } | null> {
  const res = await fetch(signedUrl);
  if (!res.ok) throw new Error(`Mirror fetch failed (${res.status})`);
  const bytes = await res.arrayBuffer();
  return vaultWrite(path, bytes);
}

function mirrorToVaultInBackground(path: string, signedUrl: string): void {
  if (!isDesktopApp() || mirrorAttempted.has(path)) return;
  mirrorAttempted.add(path);
  void fetchAndWriteVault(path, signedUrl).catch((err) => {
    mirrorAttempted.delete(path);
    console.warn("[storage] background vault mirror failed", path, err);
  });
}

/** Desktop: wait for a signed URL's bytes to land in the vault (warmer / prefetch). */
export async function mirrorSignedUrlToVault(
  path: string,
  signedUrl: string
): Promise<boolean> {
  if (!isDesktopApp() || !path || !signedUrl) return false;
  if (await vaultHas(path)) return true;
  if (signedUrl.startsWith("tempo-local://")) return true;
  mirrorAttempted.add(path);
  try {
    await fetchAndWriteVault(path, signedUrl);
    return true;
  } catch (err) {
    mirrorAttempted.delete(path);
    console.warn("[storage] vault mirror failed", path, err);
    return false;
  }
}

/**
 * Desktop only: mirror a cloud object into the vault and wait for it,
 * returning the checksum so the caller can confirm a local copy with the
 * server (see lib/api/versions.ts's mirrorTrackToVault). Unlike the passive
 * background mirror above, this is for callers that need to know the mirror
 * actually landed — e.g. registering the retention-safety precondition.
 * Returns null if not on desktop, or if the path has no cloud object left
 * to fetch (already evicted, nothing to mirror from here).
 */
export async function ensureVaultMirror(
  path: string
): Promise<{ checksum: string; size: number } | null> {
  if (!isDesktopApp()) return null;

  // Already have the cloud object — or a lossless original beside it.
  for (const candidate of [...losslessVaultSiblings(path), path]) {
    const existing = await vaultStat(candidate);
    if (existing) return { checksum: existing.checksum, size: existing.size };
  }

  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, DEFAULT_EXPIRY);
  if (error || !data?.signedUrl) return null;

  mirrorAttempted.add(path);
  try {
    return await fetchAndWriteVault(path, data.signedUrl);
  } catch (err) {
    mirrorAttempted.delete(path);
    console.warn("[storage] ensureVaultMirror failed", path, err);
    return null;
  }
}

function readSessionSignedUrls(): Record<string, SignedUrlEntry> {
  if (typeof sessionStorage === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(SIGNED_URL_SESSION_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, SignedUrlEntry>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeSessionSignedUrl(key: string, entry: SignedUrlEntry): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    const all = readSessionSignedUrls();
    const now = Date.now();
    for (const [k, v] of Object.entries(all)) {
      if (!v || typeof v.expiresAt !== "number" || v.expiresAt <= now) {
        delete all[k];
      }
    }
    all[key] = entry;
    sessionStorage.setItem(SIGNED_URL_SESSION_KEY, JSON.stringify(all));
  } catch {
    /* quota / private mode — memory cache still works */
  }
}

function removeSessionSignedUrl(path: string): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    const all = readSessionSignedUrls();
    let changed = false;
    for (const key of Object.keys(all)) {
      const sep = key.indexOf(":");
      if (sep >= 0 && key.slice(sep + 1) === path) {
        delete all[key];
        changed = true;
      }
    }
    if (changed) {
      sessionStorage.setItem(SIGNED_URL_SESSION_KEY, JSON.stringify(all));
    }
  } catch {
    /* ignore */
  }
}

function isFresh(entry: SignedUrlEntry | undefined): entry is SignedUrlEntry {
  return !!entry && entry.expiresAt - Date.now() > SIGNED_URL_REFRESH_BUFFER_MS;
}

/** Sync peek for UI that wants to avoid a blank flash while signing. */
export function peekSignedUrl(
  path: string,
  expiresInSeconds = DEFAULT_EXPIRY
): string | null {
  if (!path) return null;
  if (
    path.startsWith("/") ||
    path.startsWith("http://") ||
    path.startsWith("https://") ||
    path.startsWith("data:") ||
    path.startsWith("blob:")
  ) return path;

  const key = signedUrlCacheKey(path, expiresInSeconds);
  const mem = signedUrlMemory.get(key);
  if (isFresh(mem)) return mem.url;

  const session = readSessionSignedUrls()[key];
  if (isFresh(session)) {
    signedUrlMemory.set(key, session);
    return session.url;
  }
  return null;
}

/**
 * Remember a signed URL obtained outside createSignedUrl (scene / social
 * proxy routes, artwork helpers). Keeps <img> src stable so the browser
 * can reuse the bytes, and mirrors into the desktop vault on first sight.
 */
export function cacheSignedUrl(
  path: string,
  url: string,
  expiresInSeconds = DEFAULT_EXPIRY
): void {
  if (!path || !url) return;
  if (
    path.startsWith("/") ||
    path.startsWith("http://") ||
    path.startsWith("https://") ||
    path.startsWith("data:") ||
    path.startsWith("blob:")
  ) {
    return;
  }
  const key = signedUrlCacheKey(path, expiresInSeconds);
  const entry: SignedUrlEntry = {
    url,
    expiresAt: Date.now() + expiresInSeconds * 1000,
  };
  signedUrlMemory.set(key, entry);
  writeSessionSignedUrl(key, entry);
  mirrorToVaultInBackground(path, url);
}

export async function getSignedUrl(
  path: string,
  expiresInSeconds = DEFAULT_EXPIRY
): Promise<string> {
  if (!path) throw new Error("Missing file path.");
  if (
    path.startsWith("/") ||
    path.startsWith("http://") ||
    path.startsWith("https://") ||
    path.startsWith("data:") ||
    path.startsWith("blob:") ||
    path.startsWith("tempo-local://")
  ) {
    return path;
  }

  // Desktop: a local hit skips the network entirely — no signing, no
  // waiting on a connection. Prefer a lossless sibling when the cloud
  // path is mp3 but the vault still holds the original wav/aiff.
  if (isDesktopApp()) {
    for (const candidate of [...losslessVaultSiblings(path), path]) {
      const local = await vaultResolveUrl(candidate);
      if (local) return local;
    }
  }

  const cached = peekSignedUrl(path, expiresInSeconds);
  if (cached) return cached;

  const key = signedUrlCacheKey(path, expiresInSeconds);
  const inflight = signedUrlInflight.get(key);
  if (inflight) return inflight;

  const request = (async () => {
    const supabase = createClient();
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, expiresInSeconds);

    if (error || !data?.signedUrl) {
      throw mapStorageError(error?.message ?? "Could not create a download link.");
    }

    const entry: SignedUrlEntry = {
      url: data.signedUrl,
      expiresAt: Date.now() + expiresInSeconds * 1000,
    };
    signedUrlMemory.set(key, entry);
    writeSessionSignedUrl(key, entry);
    mirrorToVaultInBackground(path, data.signedUrl);
    return data.signedUrl;
  })();

  signedUrlInflight.set(key, request);
  try {
    return await request;
  } finally {
    signedUrlInflight.delete(key);
  }
}

const BATCH_SIGN_CHUNK = 40;

/**
 * Sign many storage paths in fewer round-trips and fill the session cache so
 * SignedImage mounts can paint without waiting on per-tile createSignedUrl.
 * Skips paths that already have a fresh cache entry. Paths that need the
 * scene/social proxy should use resolveStorageImageUrl instead.
 */
export async function warmSignedUrls(
  paths: string[],
  expiresInSeconds = DEFAULT_EXPIRY
): Promise<number> {
  const need: string[] = [];
  const seen = new Set<string>();
  for (const raw of paths) {
    const path = raw?.trim();
    if (!path || seen.has(path)) continue;
    seen.add(path);
    if (
      path.startsWith("/") ||
      path.startsWith("http://") ||
      path.startsWith("https://") ||
      path.startsWith("data:") ||
      path.startsWith("blob:") ||
      path.startsWith("tempo-local://")
    ) {
      continue;
    }
    if (/^scenes\//.test(path) || /^(artists|profiles)\//.test(path)) {
      continue;
    }
    if (peekSignedUrl(path, expiresInSeconds)) continue;
    need.push(path);
  }
  if (need.length === 0) return 0;

  let warmed = 0;
  const supabase = createClient();

  for (let i = 0; i < need.length; i += BATCH_SIGN_CHUNK) {
    const chunk = need.slice(i, i + BATCH_SIGN_CHUNK);
    try {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrls(chunk, expiresInSeconds);
      if (error || !data) continue;
      for (const row of data) {
        const signed = row.signedUrl ?? null;
        const path = typeof row.path === "string" ? row.path : null;
        if (!signed || !path || row.error) continue;
        cacheSignedUrl(path, signed, expiresInSeconds);
        warmed += 1;
      }
    } catch {
      /* best-effort — individual SignedImage resolves still work */
    }
  }

  return warmed;
}

/** Drop cached signed URLs for a storage path (call when the file is replaced/removed). */
export function invalidateSignedUrl(path: string): void {
  if (!path || path.startsWith("http://") || path.startsWith("https://")) return;
  for (const key of Array.from(signedUrlMemory.keys())) {
    const sep = key.indexOf(":");
    if (sep >= 0 && key.slice(sep + 1) === path) {
      signedUrlMemory.delete(key);
    }
  }
  removeSessionSignedUrl(path);
}

export async function deleteFile(path: string): Promise<void> {
  if (
    !path ||
    path.startsWith("/") ||
    path.startsWith("http://") ||
    path.startsWith("https://") ||
    path.startsWith("data:") ||
    path.startsWith("blob:")
  ) {
    return;
  }
  invalidateSignedUrl(path);
  const supabase = createClient();
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw mapStorageError(error.message);
  // Full delete (not a cloud-only eviction — see lib/version-prune.ts) takes
  // the local vault copy with it too, so a manually deleted bounce doesn't
  // linger on disk with no row to explain it. Also clear any lossless
  // original that sat beside a cloud mp3 path.
  if (isDesktopApp()) {
    void vaultRemove(path);
    for (const sibling of losslessVaultSiblings(path)) {
      void vaultRemove(sibling);
    }
  }
}

/**
 * Cloud-only removal for automatic retention (lib/version-prune.ts). Unlike
 * deleteFile, this deliberately leaves any local vault copy untouched — the
 * whole point of eviction is that the bounce survives on disk after leaving
 * the cloud. The version row is untouched here too; the caller flips
 * cloud_state separately once this succeeds.
 */
export async function evictFromCloud(path: string): Promise<void> {
  if (
    !path ||
    path.startsWith("/") ||
    path.startsWith("http://") ||
    path.startsWith("https://") ||
    path.startsWith("data:") ||
    path.startsWith("blob:")
  ) {
    return;
  }
  invalidateSignedUrl(path);
  const supabase = createClient();
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw mapStorageError(error.message);
}

function uploadWithProgress(
  path: string,
  file: File | Blob,
  accessToken: string,
  contentType: string,
  onProgress: (percent: number) => void,
  signal?: AbortSignal
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
    if (signal?.aborted) {
      reject(new Error("Upload cancelled."));
      return;
    }
    signal?.addEventListener("abort", () => xhr.abort(), { once: true });
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
  if (
    lower.includes("payload") ||
    lower.includes("too large") ||
    lower.includes("exceeded") ||
    lower.includes("maximum allowed size") ||
    lower.includes("entity too large") ||
    lower.includes("413")
  ) {
    return new Error(
      "Upload failed — this file is over your Supabase storage size limit (often 50 MB by default, even though TEMPO allows up to 200 MB). In Supabase → Storage → Settings, raise “Global file size limit” to at least 200 MB, then try again — or bounce a smaller format."
    );
  }
  if (lower.includes("invalid key") || lower.includes("invalidname")) {
    return new Error(
      "Upload failed — the file name isn’t valid for storage. Try renaming it to something simple (letters, numbers, dashes) and upload again."
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
