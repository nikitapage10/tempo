import { createClient } from "@/lib/supabase/client";
import {
  convertLosslessToMp3,
  mp3FilenameForOriginal,
  needsMp3Conversion,
} from "@/lib/audio-convert";
import { logActivity } from "@/lib/api/activity";
import { notify } from "@/lib/api/notify";
import {
  AUDIO_EXTENSIONS,
  MAX_CLOUD_VERSIONS_PER_TRACK,
  MAX_UPLOAD_BYTES,
} from "@/lib/constants";
import {
  buildStoragePath,
  deleteFile,
  ensureVaultMirror,
  evictFromCloud,
  uploadFile,
} from "@/lib/storage";
import { isDesktopApp, vaultRemove, vaultWrite } from "@/lib/desktop/bridge";
import {
  fetchLocalCopiesForVersions,
  recordLocalCopy,
} from "@/lib/api/version-local-copies";
import { selectVersionsToEvict } from "@/lib/version-prune";
import type { MilestoneType, Version } from "@/lib/types";

/** Old rows predate the milestone/pin/cloud-state columns — default them so callers never see undefined. */
function normalizeVersion(row: Version): Version {
  return {
    ...row,
    is_pinned: row.is_pinned ?? false,
    milestone_type: row.milestone_type ?? null,
    milestone_label: row.milestone_label ?? null,
    pinned_at: row.pinned_at ?? null,
    cloud_state: row.cloud_state ?? "in_cloud",
    evicted_at: row.evicted_at ?? null,
  };
}

export async function fetchVersions(trackId: string): Promise<Version[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("versions")
    .select("*")
    .eq("track_id", trackId)
    .order("version_no", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(normalizeVersion);
}

/** Batch versions fetch across many tracks — used by the release workspace (master/artwork status). */
export async function fetchVersionsForTracks(
  trackIds: string[]
): Promise<Map<string, Version[]>> {
  const map = new Map<string, Version[]>();
  if (trackIds.length === 0) return map;
  const supabase = createClient();
  const { data, error } = await supabase
    .from("versions")
    .select("*")
    .in("track_id", trackIds)
    .order("version_no", { ascending: false });
  if (error) throw error;
  for (const row of data ?? []) {
    const v = normalizeVersion(row);
    const list = map.get(v.track_id) ?? [];
    list.push(v);
    map.set(v.track_id, list);
  }
  return map;
}

export async function fetchCurrentVersion(
  trackId: string
): Promise<Version | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("versions")
    .select("*")
    .eq("track_id", trackId)
    .eq("is_current", true)
    .maybeSingle();
  if (error) throw error;
  return data ? normalizeVersion(data) : null;
}

export type UploadPhase = "converting" | "uploading";

export type UploadVersionInput = {
  trackId: string;
  file: File;
  changelog?: string;
  label?: string;
  onProgress?: (percent: number) => void;
  onPhase?: (phase: UploadPhase) => void;
};

export function assertAudioFile(file: File): void {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(
      "Upload failed — file is over 200 MB. Bounce a smaller format or compress the wav."
    );
  }
  const lower = file.name.toLowerCase();
  const okExt = AUDIO_EXTENSIONS.some((ext) => lower.endsWith(ext));
  const okMime =
    !file.type ||
    file.type.startsWith("audio/") ||
    file.type === "video/mp4"; /* some browsers tag m4a as video/mp4 */
  if (!okExt && !okMime) {
    throw new Error(
      "That file type isn’t supported — use mp3, wav, aiff, or m4a."
    );
  }
}

export async function uploadVersion(
  input: UploadVersionInput
): Promise<Version> {
  assertAudioFile(input.file);

  const originalLabel =
    input.label?.trim() ||
    input.file.name.replace(/\.[^.]+$/, "") ||
    "Bounce";

  const versionId = crypto.randomUUID();
  const desktop = isDesktopApp();
  const lossless = needsMp3Conversion(input.file);

  // Desktop + wav/aiff: keep the original in the local vault immediately,
  // convert only for the cloud twin (the newest two in_cloud bounces). The
  // web path still converts before upload so the bucket never stores wav.
  let fileForCloud = input.file;
  let fileSizeForRow = input.file.size;
  let vaultChecksum: string | null = null;
  let cloudPath: string;
  let originalVaultPath: string | null = null;

  if (desktop && lossless) {
    originalVaultPath = buildStoragePath({
      trackId: input.trackId,
      kind: "version",
      entityId: versionId,
      filename: input.file.name,
    });
    cloudPath = buildStoragePath({
      trackId: input.trackId,
      kind: "version",
      entityId: versionId,
      filename: mp3FilenameForOriginal(input.file.name),
    });

    input.onPhase?.("uploading");
    input.onProgress?.(0);
    try {
      const written = await vaultWrite(
        originalVaultPath,
        await input.file.arrayBuffer()
      );
      if (!written) {
        throw new Error(
          "Couldn’t save that bounce on this computer — check disk space and try again."
        );
      }
      vaultChecksum = written.checksum;
      fileSizeForRow = written.size;
    } catch (err) {
      if (err instanceof Error && err.message.startsWith("Couldn’t save")) {
        throw err;
      }
      console.error("[tempo] vault write for original bounce failed", err);
      throw new Error(
        "Couldn’t save that bounce on this computer — check disk space and try again."
      );
    }

    input.onPhase?.("converting");
    input.onProgress?.(0);
    try {
      fileForCloud = await convertLosslessToMp3(input.file, input.onProgress);
    } catch (err) {
      // Original is safe in the vault — refuse to put wav in the cloud.
      throw err instanceof Error
        ? err
        : new Error(
            "Couldn’t convert that bounce for the cloud — export an mp3 from your DAW, or try again."
          );
    }

    if (fileForCloud.size > MAX_UPLOAD_BYTES) {
      throw new Error(
        "Upload failed — even after converting to mp3 this file is over 200 MB. Export a shorter bounce or a lower bitrate mp3 from your DAW."
      );
    }

    input.onPhase?.("uploading");
    input.onProgress?.(0);
    try {
      await uploadFile(cloudPath, fileForCloud, {
        onProgress: input.onProgress,
        contentType: fileForCloud.type || "audio/mpeg",
        skipVault: true,
      });
    } catch (err) {
      throw err instanceof Error
        ? err
        : new Error("Upload failed — try again, or pick a different file.");
    }
  } else {
    if (lossless) {
      input.onPhase?.("converting");
      input.onProgress?.(0);
      try {
        fileForCloud = await convertLosslessToMp3(input.file, input.onProgress);
      } catch (err) {
        if (input.file.size <= MAX_UPLOAD_BYTES) {
          console.warn("[tempo] mp3 conversion failed; uploading original", err);
          fileForCloud = input.file;
        } else {
          throw err instanceof Error
            ? err
            : new Error(
                "Couldn’t convert that bounce — export an mp3 from your DAW and upload that."
              );
        }
      }
    }

    if (fileForCloud.size > MAX_UPLOAD_BYTES) {
      throw new Error(
        "Upload failed — even after converting to mp3 this file is over 200 MB. Export a shorter bounce or a lower bitrate mp3 from your DAW."
      );
    }

    fileSizeForRow = fileForCloud.size;
    cloudPath = buildStoragePath({
      trackId: input.trackId,
      kind: "version",
      entityId: versionId,
      filename: fileForCloud.name,
    });

    input.onPhase?.("uploading");
    input.onProgress?.(0);

    try {
      const uploadResult = await uploadFile(cloudPath, fileForCloud, {
        onProgress: input.onProgress,
        contentType: fileForCloud.type || "audio/mpeg",
      });
      if (uploadResult.vault) vaultChecksum = uploadResult.vault.checksum;
    } catch (err) {
      throw err instanceof Error
        ? err
        : new Error("Upload failed — try again, or pick a different file.");
    }
  }

  const supabase = createClient();

  const { data, error } = await supabase
    .from("versions")
    .insert({
      id: versionId,
      track_id: input.trackId,
      version_no: 0, // DB trigger assigns the real number
      label: originalLabel,
      changelog: input.changelog?.trim() || null,
      file_url: cloudPath,
      file_size: fileSizeForRow,
      is_current: true,
    })
    .select()
    .single();

  if (error) {
    try {
      await deleteFile(cloudPath);
    } catch {
      /* best-effort cleanup */
    }
    if (originalVaultPath) {
      try {
        await vaultRemove(originalVaultPath);
      } catch {
        /* best-effort */
      }
    }
    throw new Error(
      `Couldn’t save the version — ${error.message}. The file upload was rolled back; try again.`
    );
  }

  // Desktop: confirm the local copy so retention eviction knows a device
  // holds the bounce once this version ages out of the cloud cap.
  if (vaultChecksum) {
    await recordLocalCopy(data.id, vaultChecksum);
  }

  await evictExcessCloudVersions(input.trackId);

  void notifyVersionUpload(input.trackId, data.id, originalLabel);

  return normalizeVersion(data);
}

/** Best-effort activity log + notify-collaborators after a version lands. */
async function notifyVersionUpload(
  trackId: string,
  versionId: string,
  label: string
): Promise<void> {
  try {
    const supabase = createClient();
    const [{ data: userData }, { data: track }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from("tracks").select("title").eq("id", trackId).maybeSingle(),
    ]);
    const actorLabel = userData.user?.email ?? null;
    await logActivity({
      trackId,
      eventType: "version_uploaded",
      summary: `${actorLabel ?? "Someone"} uploaded ${label}`,
      entityType: "version",
      entityId: versionId,
      actorLabel,
    });
    await notify({
      trackId,
      type: "new_version",
      title: `New version on ${track?.title ?? "a track"}`,
      body: `${actorLabel ?? "Someone"} uploaded ${label}.`,
    });
  } catch {
    /* best-effort — never block the upload on logging */
  }
}

/**
 * Cloud retention (TEMPO Desktop Package 3, planning/desktop/02 §5): keep at
 * most MAX_CLOUD_VERSIONS_PER_TRACK cloud objects per track — the current
 * version and the one before it — evicting only versions that already have
 * a confirmed local copy on some device. Rows are never deleted here; every
 * version stays in the history forever. Delegates the keep/evict decision
 * to lib/version-prune.ts so the rule lives in one place.
 */
async function evictExcessCloudVersions(trackId: string): Promise<void> {
  const versions = await fetchVersions(trackId);
  const localCopies = await fetchLocalCopiesForVersions(versions.map((v) => v.id));
  const toEvictIds = selectVersionsToEvict(
    versions,
    (versionId) => (localCopies.get(versionId)?.length ?? 0) > 0,
    MAX_CLOUD_VERSIONS_PER_TRACK
  );

  const supabase = createClient();
  for (const versionId of toEvictIds) {
    const version = versions.find((v) => v.id === versionId);
    if (!version) continue;
    try {
      await evictFromCloud(version.file_url);
      await supabase
        .from("versions")
        .update({ cloud_state: "local_only", evicted_at: new Date().toISOString() })
        .eq("id", versionId);
    } catch {
      /* best-effort — it stays in_cloud past the cap until the next upload retries this */
    }
  }
}

/**
 * Desktop only: proactively mirror every in-cloud version of a track into
 * this device's vault and confirm each copy with the server. Called when a
 * desktop artist opens a track, so its whole bounce history becomes
 * available offline rather than only the version they happen to play.
 * No-ops entirely on the web.
 */
export async function mirrorTrackToVault(versions: Version[]): Promise<void> {
  if (!isDesktopApp()) return;
  for (const version of versions) {
    if (version.cloud_state !== "in_cloud") continue;
    try {
      const result = await ensureVaultMirror(version.file_url);
      if (result) await recordLocalCopy(version.id, result.checksum);
    } catch {
      /* best-effort — playback still works normally against the cloud */
    }
  }
}

export async function setCurrentVersion(
  trackId: string,
  versionId: string
): Promise<Version> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("versions")
    .update({ is_current: true })
    .eq("id", versionId)
    .eq("track_id", trackId)
    .select()
    .single();
  if (error) throw error;
  return normalizeVersion(data);
}

export type PinVersionInput = {
  milestoneType?: MilestoneType | null;
  milestoneLabel?: string | null;
};

/** Pin a version so it survives pruning; optionally tag it as a milestone. */
export async function pinVersion(
  versionId: string,
  input: PinVersionInput = {}
): Promise<Version> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("versions")
    .update({
      is_pinned: true,
      milestone_type: input.milestoneType ?? null,
      milestone_label: input.milestoneLabel?.trim() || null,
      pinned_at: new Date().toISOString(),
    })
    .eq("id", versionId)
    .select()
    .single();
  if (error) throw error;
  return normalizeVersion(data);
}

/** Unpin a version — it becomes eligible for pruning again on the next upload. */
export async function unpinVersion(versionId: string): Promise<Version> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("versions")
    .update({
      is_pinned: false,
      milestone_type: null,
      milestone_label: null,
      pinned_at: null,
    })
    .eq("id", versionId)
    .select()
    .single();
  if (error) throw error;
  return normalizeVersion(data);
}

export async function updateVersionDuration(
  versionId: string,
  duration: number
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("versions")
    .update({ duration })
    .eq("id", versionId);
  if (error) throw error;
}

export async function deleteVersion(version: Version): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("versions")
    .delete()
    .eq("id", version.id);
  if (error) throw error;
  try {
    await deleteFile(version.file_url);
  } catch {
    /* DB row is gone; orphaned file is acceptable to clean later */
  }
}

/** Count version uploads since local Monday 00:00 (for Lightfield activity). */
export async function countVersionsThisWeek(): Promise<number> {
  const supabase = createClient();
  const now = new Date();
  const day = (now.getDay() + 6) % 7; // Mon=0
  const start = new Date(now);
  start.setDate(now.getDate() - day);
  start.setHours(0, 0, 0, 0);

  const { count, error } = await supabase
    .from("versions")
    .select("*", { count: "exact", head: true })
    .gte("created_at", start.toISOString());
  if (error) throw error;
  return count ?? 0;
}
