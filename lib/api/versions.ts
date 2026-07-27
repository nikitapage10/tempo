import { createClient } from "@/lib/supabase/client";
import {
  AUDIO_EXTENSIONS,
  MAX_UPLOAD_BYTES,
  MAX_VERSIONS_PER_TRACK,
} from "@/lib/constants";
import { buildStoragePath, deleteFile, uploadFile } from "@/lib/storage";
import type { Version } from "@/lib/types";

export async function fetchVersions(trackId: string): Promise<Version[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("versions")
    .select("*")
    .eq("track_id", trackId)
    .order("version_no", { ascending: false });
  if (error) throw error;
  return data ?? [];
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
  return data;
}

export type UploadVersionInput = {
  trackId: string;
  file: File;
  changelog?: string;
  label?: string;
  onProgress?: (percent: number) => void;
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

  const versionId = crypto.randomUUID();
  const path = buildStoragePath({
    trackId: input.trackId,
    kind: "version",
    entityId: versionId,
    filename: input.file.name,
  });

  try {
    await uploadFile(path, input.file, {
      onProgress: input.onProgress,
      contentType: input.file.type || undefined,
    });
  } catch (err) {
    throw err instanceof Error
      ? err
      : new Error("Upload failed — try again, or pick a different file.");
  }

  const supabase = createClient();
  const label =
    input.label?.trim() ||
    input.file.name.replace(/\.[^.]+$/, "") ||
    "Bounce";

  const { data, error } = await supabase
    .from("versions")
    .insert({
      id: versionId,
      track_id: input.trackId,
      version_no: 0, // DB trigger assigns the real number
      label,
      changelog: input.changelog?.trim() || null,
      file_url: path,
      file_size: input.file.size,
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

  return data;
}

/** Keep only the newest N versions; delete older rows + storage files. */
async function pruneOldVersions(trackId: string): Promise<void> {
  const versions = await fetchVersions(trackId);
  if (versions.length <= MAX_VERSIONS_PER_TRACK) return;

  const toDelete = versions.slice(MAX_VERSIONS_PER_TRACK);
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
  return data;
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
