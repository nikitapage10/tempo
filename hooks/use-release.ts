"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteReleaseTrackMetadata,
  fetchReleaseDetails,
  fetchReleaseTrackMetadata,
  upsertReleaseDetails,
  upsertReleaseTrackMetadata,
  type UpsertReleaseDetailsInput,
  type UpsertReleaseTrackMetadataInput,
} from "@/lib/api/release";

export function useReleaseDetails(projectId: string | null) {
  return useQuery({
    queryKey: ["release-details", projectId],
    queryFn: () => fetchReleaseDetails(projectId!),
    enabled: !!projectId,
  });
}

export function useReleaseTrackMetadata(projectId: string | null) {
  return useQuery({
    queryKey: ["release-track-metadata", projectId],
    queryFn: () => fetchReleaseTrackMetadata(projectId!),
    enabled: !!projectId,
  });
}

export function useReleaseMutations(projectId: string | null) {
  const qc = useQueryClient();

  const saveDetails = useMutation({
    mutationFn: (patch: UpsertReleaseDetailsInput) =>
      upsertReleaseDetails(projectId!, patch),
    onSuccess: (data) => {
      qc.setQueryData(["release-details", projectId], data);
      qc.invalidateQueries({ queryKey: ["calendar"] });
    },
  });

  const saveTrackMetadata = useMutation({
    mutationFn: ({
      trackId,
      patch,
    }: {
      trackId: string;
      patch: UpsertReleaseTrackMetadataInput;
    }) => upsertReleaseTrackMetadata(projectId!, trackId, patch),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["release-track-metadata", projectId] }),
  });

  const removeTrackMetadata = useMutation({
    mutationFn: (id: string) => deleteReleaseTrackMetadata(id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["release-track-metadata", projectId] }),
  });

  return { saveDetails, saveTrackMetadata, removeTrackMetadata };
}
