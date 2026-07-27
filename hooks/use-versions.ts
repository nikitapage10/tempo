"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteVersion,
  fetchVersions,
  setCurrentVersion,
  updateVersionDuration,
  uploadVersion,
  type UploadVersionInput,
} from "@/lib/api/versions";
import type { Version } from "@/lib/types";

export function useVersions(trackId: string | null) {
  return useQuery({
    queryKey: ["versions", trackId],
    queryFn: () => fetchVersions(trackId!),
    enabled: !!trackId,
  });
}

export function useVersionMutations(trackId: string | null) {
  const qc = useQueryClient();
  const key = ["versions", trackId] as const;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ["version-count", trackId] });
    qc.invalidateQueries({ queryKey: ["track", trackId] });
  };

  const upload = useMutation({
    mutationFn: (input: Omit<UploadVersionInput, "trackId">) =>
      uploadVersion({ ...input, trackId: trackId! }),
    onSuccess: invalidate,
  });

  const setCurrent = useMutation({
    mutationFn: (versionId: string) => setCurrentVersion(trackId!, versionId),
    onMutate: async (versionId) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Version[]>(key);
      if (prev) {
        qc.setQueryData<Version[]>(
          key,
          prev.map((v) => ({ ...v, is_current: v.id === versionId }))
        );
      }
      return { prev };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: invalidate,
  });

  const remove = useMutation({
    mutationFn: (version: Version) => deleteVersion(version),
    onSuccess: invalidate,
  });

  const setDuration = useMutation({
    mutationFn: ({
      versionId,
      duration,
    }: {
      versionId: string;
      duration: number;
    }) => updateVersionDuration(versionId, duration),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return { upload, setCurrent, remove, setDuration };
}
