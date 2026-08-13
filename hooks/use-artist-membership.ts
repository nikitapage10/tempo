"use client";

import { useQuery } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/use-current-user";
import { listMemberOfArtists } from "@/lib/api/artist-members";
import { AREA_KEYS, type AreaGrants } from "@/lib/team/areas";
import type { Artist } from "@/lib/types";

const FULL_ACCESS: AreaGrants = Object.fromEntries(
  AREA_KEYS.map((k) => [k, "write"])
) as AreaGrants;

/**
 * "What can the signed-in person actually do with this artist" — owner gets
 * full access by definition; a team member (migration 089/090) gets exactly
 * their stored grants. UI hiding only, same caveat as
 * lib/permissions.ts/deriveCapabilities: RLS is what actually enforces this,
 * this is just what decides whether to show the control at all.
 */
export function useArtistMembership(artist: Artist | null): {
  isOwner: boolean;
  areas: AreaGrants;
  isLoading: boolean;
} {
  const user = useCurrentUser();
  const isOwner = !!artist && !!user && artist.user_id === user.id;

  const membershipsQuery = useQuery({
    queryKey: ["member-of-artists", user?.id],
    queryFn: listMemberOfArtists,
    enabled: !!user && !isOwner,
    staleTime: 60_000,
  });

  if (!artist || !user) {
    return { isOwner: false, areas: {}, isLoading: user === undefined };
  }
  if (isOwner) {
    return { isOwner: true, areas: FULL_ACCESS, isLoading: false };
  }

  const membership = membershipsQuery.data?.find((m) => m.artistId === artist.id);
  return {
    isOwner: false,
    areas: membership?.areas ?? {},
    isLoading: membershipsQuery.isLoading,
  };
}
