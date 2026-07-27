import { createClient } from "@/lib/supabase/client";
import {
  convertLosslessToMp3,
  needsMp3Conversion,
} from "@/lib/audio-convert";
import { logActivity } from "@/lib/api/activity";
import { notify } from "@/lib/api/notify";
import {
  AUDIO_EXTENSIONS,
  MAX_UPLOAD_BYTES,
  MAX_VERSIONS_PER_TRACK,
} from "@/lib/constants";
import { buildStoragePath, deleteFile, uploadFile } from "@/lib/storage";
import { selectVersionsToPrune } from "@/lib/version-prune";
import type { MilestoneType, Version } from "@/lib/types";

/** Old rows predate the milestone/pin columns — default them so callers never see undefined. */
function normalizeVersion(row: Version): Version {
  return {
    ...row,
    is_pinned: row.is_pinned ?? false,
    milestone_type: row.milestone_type ?? null,
    milestone_label: row.milestone_label ?? null,
    pinned_at: row.pinned_at ?? null,
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

  let fileToUpload = input.file;
  const originalLabel =
    input.label?.trim() ||
    input.file.name.replace(/\.[^.]+$/, "") ||
    "Bounce";

  if (needsMp3Conversion(input.file)) {
    input.onPhase?.("converting");
    input.onProgress?.(0);
    try {
      fileToUpload = await convertLosslessToMp3(input.file, input.onProgress);
    } catch (err) {
      // If conversion fails but the original is still under the app cap, upload it.
      if (input.file.size <= MAX_UPLOAD_BYTES) {
        console.warn("[tempo] mp3 conversion failed; uploading original", err);
        fileToUpload = input.file;
      } else {
        throw err instanceof Error
          ? err
          : new Error(
              "Couldn’t convert that bounce — export an mp3 from your DAW and upload that."
            );
      }
    }
  }

  if (fileToUpload.size > MAX_UPLOAD_BYTES) {
    throw new Error(
      "Upload failed — even after converting to mp3 this file is over 200 MB. Export a shorter bounce or a lower bitrate mp3 from your DAW."
    );
  }

  input.onPhase?.("uploading");
  input.onProgress?.(0);

  const versionId = crypto.randomUUID();
  const path = buildStoragePath({
    trackId: input.trackId,
    kind: "version",
    entityId: versionId,
    filename: fileToUpload.name,
  });

  try {
    await uploadFile(path, fileToUpload, {
      onProgress: input.onProgress,
      contentType: fileToUpload.type || "audio/mpeg",
    });
  } catch (err) {
    throw err instanceof Error
      ? err
      : new Error("Upload failed — try again, or pick a different file.");
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
      file_url: path,
      file_size: fileToUpload.size,
      is_current: true,
    })
    .select()
    .single();

  if (error) {
    try {
      await deleteFile(path);
    } catch {
      /* best-effort cleanup */
    }
    throw new Error(
      `Couldn’t save the version — ${error.message}. The file upload was rolled back; try again.`
    );
  }

  await pruneOldVersions(input.trackId);

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
 * Keep every pinned version plus the newest MAX_VERSIONS_PER_TRACK unpinned
 * versions; delete the rest (and their storage files). Never touches the
 * current version. Delegates the keep/delete decision to
 * lib/version-prune.ts so the rule lives in one place.
 */
async function pruneOldVersions(trackId: string): Promise<void> {
  const versions = await fetchVersions(trackId);
  const toDelete = selectVersionsToPrune(versions, MAX_VERSIONS_PER_TRACK);
  for (const v of toDelete) {
    try {
      await deleteVersion(v);
    } catch {
      /* best-effort — list refresh will show what's left */
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
