"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteAsset,
  fetchAssets,
  uploadAsset,
  type UploadAssetInput,
} from "@/lib/api/assets";
import type { Asset } from "@/lib/types";

export function useAssets(trackId: string | null) {
  return useQuery({
    queryKey: ["assets", trackId],
    queryFn: () => fetchAssets(trackId!),
    enabled: !!trackId,
  });
}

export function useAssetMutations(trackId: string | null) {
  const qc = useQueryClient();
  const key = ["assets", trackId] as const;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ["track", trackId] });
    qc.invalidateQueries({ queryKey: ["tracks"] });
  };

  const upload = useMutation({
    mutationFn: (input: Omit<UploadAssetInput, "trackId">) =>
      uploadAsset({ ...input, trackId: trackId! }),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (asset: Asset) => deleteAsset(asset),
    onSuccess: invalidate,
  });

  return { upload, remove };
}
