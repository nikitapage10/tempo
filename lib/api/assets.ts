import { createClient } from "@/lib/supabase/client";
import { MAX_UPLOAD_BYTES } from "@/lib/constants";
import { buildStoragePath, deleteFile, uploadFile } from "@/lib/storage";
import { updateTrack } from "@/lib/api/tracks";
import type { Asset, AssetKind } from "@/lib/types";

export async function fetchAssets(trackId: string): Promise<Asset[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("assets")
    .select("*")
    .eq("track_id", trackId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export type UploadAssetInput = {
  trackId: string;
  file: File;
  kind: AssetKind;
  name?: string;
  onProgress?: (percent: number) => void;
};

export async function uploadAsset(input: UploadAssetInput): Promise<Asset> {
  if (input.file.size > MAX_UPLOAD_BYTES) {
    throw new Error(
      "Upload failed — file is over 200 MB. Bounce a smaller format or compress the file."
    );
  }

  const assetId = crypto.randomUUID();
  const path = buildStoragePath({
    trackId: input.trackId,
    kind: "asset",
    entityId: assetId,
    filename: input.file.name,
  });

  await uploadFile(path, input.file, {
    onProgress: input.onProgress,
    contentType: input.file.type || undefined,
  });

  const supabase = createClient();
  const name = input.name?.trim() || input.file.name;

  const { data, error } = await supabase
    .from("assets")
    .insert({
      id: assetId,
      track_id: input.trackId,
      kind: input.kind,
      name,
      file_url: path,
      file_size: input.file.size,
    })
    .select()
    .single();

  if (error) {
    try {
      await deleteFile(path);
    } catch {
      /* best-effort */
    }
    throw new Error(
      `Couldn’t save the asset — ${error.message}. Try uploading again.`
    );
  }

  if (input.kind === "artwork") {
    try {
      await updateTrack(input.trackId, { artwork_url: path });
    } catch {
      /* asset exists; artwork thumb can be set manually later */
    }
  }

  return data;
}

export async function deleteAsset(asset: Asset): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("assets").delete().eq("id", asset.id);
  if (error) throw error;
  try {
    await deleteFile(asset.file_url);
  } catch {
    /* ignore orphan */
  }
}
