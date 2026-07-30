"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchArtistStats } from "@/lib/api/artist-stats";
import { summarizeArtist, type ArtistOverview } from "@/lib/artist-stats";

/**
 * Artist-wide rollup across every space the artist owns.
 *
 * The raw fetch is cached under ["artist-stats", artistId]; the summary is
 * derived in a memo so re-renders (hover, tooltips) never redo the rollup.
 */
export function useArtistStats(artistId: string | null): {
  data: ArtistOverview | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
} {
  const query = useQuery({
    queryKey: ["artist-stats", artistId],
    queryFn: () => fetchArtistStats(artistId!),
    enabled: !!artistId,
    staleTime: 60_000,
  });

  const data = React.useMemo(
    () => (query.data ? summarizeArtist(query.data) : undefined),
    [query.data]
  );

  return {
    data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error as Error | null,
  };
}
