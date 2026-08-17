"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  cancelArtistTeamRequest,
  createArtistTeamRequest,
  listArtistTeamRequests,
  listMyTeamRequests,
  respondToArtistTeamRequest,
} from "@/lib/api/team-requests";

export function useMyTeamRequests() {
  return useQuery({
    queryKey: ["artist-team-requests", "mine"],
    queryFn: listMyTeamRequests,
    staleTime: 15_000,
  });
}

export function useArtistTeamRequests(artistId: string | null) {
  return useQuery({
    queryKey: ["artist-team-requests", "artist", artistId],
    queryFn: () => listArtistTeamRequests(artistId!),
    enabled: !!artistId,
    staleTime: 15_000,
  });
}

export function useTeamRequestMutations(artistId?: string | null) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["artist-team-requests", "mine"] });
    if (artistId) {
      queryClient.invalidateQueries({
        queryKey: ["artist-team-requests", "artist", artistId],
      });
      queryClient.invalidateQueries({ queryKey: ["artist-members", artistId] });
    }
    queryClient.invalidateQueries({ queryKey: ["pending-team-invites"] });
  };

  const create = useMutation({ mutationFn: createArtistTeamRequest, onSuccess: invalidate });
  const cancel = useMutation({ mutationFn: cancelArtistTeamRequest, onSuccess: invalidate });
  const respond = useMutation({ mutationFn: respondToArtistTeamRequest, onSuccess: invalidate });

  return { create, cancel, respond };
}
