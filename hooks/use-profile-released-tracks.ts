"use client";

import { useQuery } from "@tanstack/react-query";
import type { ProfileReleasedTrack } from "@/lib/types";

async function fetchProfileReleasedTracks(
  artistId: string
): Promise<ProfileReleasedTrack[]> {
  const response = await fetch(
    `/api/artist-profile/${encodeURIComponent(artistId)}/released-tracks`,
    { cache: "no-store" }
  );
  if (response.status === 404) return [];
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || "Couldnâ€™t load released tracks.");
  }
  return body.tracks ?? [];
}

export function useProfileReleasedTracks(artistId: string | null) {
  const query = useQuery({
    queryKey: ["profile-released-tracks", artistId],
    queryFn: () => fetchProfileReleasedTracks(artistId!),
    enabled: !!artistId,
    staleTime: 60_000,
    retry: false,
  });

  return {
    tracks: query.data ?? [],
    isLoading: query.isLoading,
  };
}
