"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteVersion,
  fetchVersions,
  fetchVersionsForTracks,
  mirrorTrackToVault,
  pinVersion,
  setCurrentVersion,
  unpinVersion,
  updateVersionDuration,
  uploadVersion,
  type PinVersionInput,
  type UploadVersionInput,
} from "@/lib/api/versions";
import { isDesktopApp } from "@/lib/desktop/bridge";
import type { Version } from "@/lib/types";

export function useVersions(trackId: string | null) {
  const query = useQuery({
    queryKey: ["versions", trackId],
    queryFn: () => fetchVersions(trackId!),
    enabled: !!trackId,
  });

  // Desktop: opening a track mirrors its whole cloud-resident bounce history
  // into this device's vault, not just whatever gets played — see
  // planning/desktop/02 §3 and lib/api/versions.ts's mirrorTrackToVault.
  // One attempt per track per mount; failures are silent/best-effort there.
  const versionIdsKey = query.data?.map((v) => v.id).join(",") ?? "";
  React.useEffect(() => {
    if (!isDesktopApp() || !query.data?.length) return;
    void mirrorTrackToVault(query.data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versionIdsKey]);

  return query;
}

/** Batch versions rollup for a set of tracks (e.g. release master/artwork status). */
export function useVersionsForTracks(trackIds: string[]) {
  return useQuery({
    queryKey: ["versions-batch", [...trackIds].sort().join(",")],
    queryFn: () => fetchVersionsForTracks(trackIds),
    enabled: trackIds.length > 0,
  });
}

export function useVersionMutations(trackId: string | null) {
  const qc = useQueryClient();
  const key = ["versions", trackId] as const;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ["versions-batch"] });
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

  const pin = useMutation({
    mutationFn: ({
      versionId,
      input,
    }: {
      versionId: string;
      input?: PinVersionInput;
    }) => pinVersion(versionId, input),
    onMutate: async ({ versionId, input }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Version[]>(key);
      if (prev) {
        qc.setQueryData<Version[]>(
          key,
          prev.map((v) =>
            v.id === versionId
              ? {
                  ...v,
                  is_pinned: true,
                  milestone_type: input?.milestoneType ?? null,
                  milestone_label: input?.milestoneLabel?.trim() || null,
                  pinned_at: new Date().toISOString(),
                }
              : v
          )
        );
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: invalidate,
  });

  const unpin = useMutation({
    mutationFn: (versionId: string) => unpinVersion(versionId),
    onMutate: async (versionId) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Version[]>(key);
      if (prev) {
        qc.setQueryData<Version[]>(
          key,
          prev.map((v) =>
            v.id === versionId
              ? {
                  ...v,
                  is_pinned: false,
                  milestone_type: null,
                  milestone_label: null,
                  pinned_at: null,
                }
              : v
          )
        );
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: invalidate,
  });

  return { upload, setCurrent, remove, setDuration, pin, unpin };
}
