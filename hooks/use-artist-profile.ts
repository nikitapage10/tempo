"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchArtistProfile,
  publishArtistProfile,
  unpublishArtistProfile,
  upsertArtistProfile,
} from "@/lib/api/artist-profile";
import type { ArtistProfileUpdate } from "@/lib/types";

export function useArtistProfile(artistId: string | null) {
  const qc = useQueryClient();
  const queryKey = ["artist-profile", artistId];

  const query = useQuery({
    queryKey,
    queryFn: () => fetchArtistProfile(artistId!),
    enabled: !!artistId,
    staleTime: 30_000,
  });

  const save = useMutation({
    mutationFn: ({
      patch,
      displayName,
    }: {
      patch: ArtistProfileUpdate;
      displayName: string;
    }) => upsertArtistProfile(artistId!, patch, displayName),
    onSuccess: (profile) => qc.setQueryData(queryKey, profile),
  });

  const publish = useMutation({
    // A bare visibility string is still accepted so the many existing callers
    // read the same; joining with a handle passes the object form.
    mutationFn: (
      input:
        | "members"
        | "public"
        | {
            visibility: "members" | "public";
            handle?: string;
            displayName?: string;
          }
    ) =>
      typeof input === "string"
        ? publishArtistProfile(artistId, input)
        : publishArtistProfile(
            artistId,
            input.visibility,
            input.handle,
            input.displayName
          ),
    onSuccess: (profile) => qc.setQueryData(queryKey, profile),
  });

  const unpublish = useMutation({
    mutationFn: () => unpublishArtistProfile(artistId!),
    onSuccess: (profile) => qc.setQueryData(queryKey, profile),
  });

  return {
    profile: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error as Error | null,
    save,
    publish,
    unpublish,
  };
}
