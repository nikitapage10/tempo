"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  inviteMember,
  listActiveTeamRoster,
  listArtistMembers,
  revokeMember,
  updateMemberAreas,
  updateMemberRole,
  type InviteMemberInput,
} from "@/lib/api/artist-members";
import type { AreaGrants } from "@/lib/team/areas";
import type { MemberRole } from "@/lib/team/roles";

export function useActiveTeamRoster(artistId: string | null) {
  return useQuery({
    queryKey: ["artist-team-roster", artistId],
    queryFn: () => listActiveTeamRoster(artistId!),
    enabled: !!artistId,
    staleTime: 30_000,
  });
}

export function useArtistMembers(artistId: string | null) {
  return useQuery({
    queryKey: ["artist-members", artistId],
    queryFn: () => listArtistMembers(artistId!),
    enabled: !!artistId,
    staleTime: 30_000,
  });
}

export function useArtistMemberMutations(artistId: string | null) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["artist-members", artistId] });
    qc.invalidateQueries({ queryKey: ["artist-team-roster", artistId] });
  };

  const invite = useMutation({
    mutationFn: (input: InviteMemberInput) => inviteMember(input),
    onSuccess: invalidate,
  });

  const setAreas = useMutation({
    mutationFn: ({ id, areas }: { id: string; areas: AreaGrants }) =>
      updateMemberAreas(id, areas),
    onSuccess: invalidate,
  });

  const setRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: MemberRole }) =>
      updateMemberRole(id, role),
    onSuccess: invalidate,
  });

  const revoke = useMutation({
    mutationFn: (id: string) => revokeMember(id),
    onSuccess: invalidate,
  });

  return { invite, setAreas, setRole, revoke };
}
