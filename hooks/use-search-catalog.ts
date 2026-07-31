"use client";

import { useQuery } from "@tanstack/react-query";
import { useActiveArtist } from "@/components/active-artist-provider";
import { fetchSearchCatalog } from "@/lib/api/search-catalog";

export function useSearchCatalog(enabled = true) {
  const { activeArtistId } = useActiveArtist();
  return useQuery({
    queryKey: ["search-catalog", activeArtistId],
    queryFn: () => fetchSearchCatalog(activeArtistId!),
    enabled: enabled && !!activeArtistId,
    staleTime: 30_000,
  });
}
