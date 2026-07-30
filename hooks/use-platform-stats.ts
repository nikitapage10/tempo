"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchPlatformCatalog,
  fetchPlatformSnapshots,
  refreshPlatform,
  setPlatformLink,
  type PlatformId,
} from "@/lib/api/platform-stats";

export function usePlatformSnapshots(artistId: string | null) {
  return useQuery({
    queryKey: ["platform-snapshots", artistId],
    queryFn: () => fetchPlatformSnapshots(artistId!),
    enabled: !!artistId,
    staleTime: 60_000,
  });
}

export function usePlatformCatalog(
  artistId: string | null,
  platform: "apple" | "spotify",
  enabled: boolean
) {
  return useQuery({
    queryKey: ["platform-catalog", artistId, platform],
    queryFn: () => fetchPlatformCatalog(artistId!, platform),
    enabled: !!artistId && enabled,
    // The catalog changes on release day, not hourly.
    staleTime: 6 * 60 * 60 * 1000,
    retry: false,
  });
}

export function usePlatformMutations(artistId: string | null) {
  const qc = useQueryClient();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["platform-snapshots", artistId] });
    qc.invalidateQueries({ queryKey: ["artists"] });
    qc.invalidateQueries({ queryKey: ["platform-catalog", artistId] });
  };

  const link = useMutation({
    mutationFn: ({
      platform,
      platformId,
    }: {
      platform: "spotify" | "soundcloud" | "apple";
      platformId: string | null;
    }) => setPlatformLink(artistId!, platform, platformId),
    onSuccess: invalidate,
  });

  const refresh = useMutation({
    mutationFn: (platform: PlatformId) => refreshPlatform(artistId!, platform),
    onSuccess: invalidate,
  });

  return { link, refresh };
}
