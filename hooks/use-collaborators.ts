"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchMyRole,
  invite,
  listCollaborators,
  revokeCollaborator,
  updateRole,
  type InviteCollaboratorInput,
} from "@/lib/api/collaborators";
import type { CollaboratorRole, TrackCollaborator } from "@/lib/types";
import { useCurrentUser } from "@/hooks/use-current-user";
import { deriveCapabilities, type EffectiveRole } from "@/lib/permissions";

export function useCollaborators(trackId: string | null) {
  return useQuery({
    queryKey: ["collaborators", trackId],
    queryFn: () => listCollaborators(trackId!),
    enabled: !!trackId,
  });
}

export function useMyRole(trackId: string | null) {
  const user = useCurrentUser();
  return useQuery({
    queryKey: ["my-role", trackId, user?.id],
    queryFn: () => fetchMyRole(trackId!),
    enabled: !!trackId && !!user,
  });
}

/**
 * Effective role + UI capability flags for the current user on a track.
 * Owner check is a straight user_id compare; anything else falls back to
 * the collaborator role lookup. RLS remains authoritative for writes.
 */
export function useTrackPermissions(ownerUserId: string | null | undefined, trackId: string | null) {
  const user = useCurrentUser();
  const myRole = useMyRole(trackId);

  const isOwner = !!user && !!ownerUserId && user.id === ownerUserId;
  const isLoading = user === undefined || (!isOwner && !!trackId && myRole.isLoading);

  let role: EffectiveRole = null;
  if (isOwner) role = "owner";
  else if (myRole.data) role = myRole.data;

  return { ...deriveCapabilities(role), isLoading, userId: user?.id ?? null };
}

export function useCollaboratorMutations(trackId: string | null) {
  const qc = useQueryClient();
  const key = ["collaborators", trackId] as const;

  const invalidate = () => qc.invalidateQueries({ queryKey: key });

  const inviteCollaborator = useMutation({
    mutationFn: (input: Omit<InviteCollaboratorInput, "trackId">) =>
      invite({ ...input, trackId: trackId! }),
    onSuccess: invalidate,
  });

  const revoke = useMutation({
    mutationFn: (id: string) => revokeCollaborator(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<TrackCollaborator[]>(key);
      if (prev) {
        qc.setQueryData<TrackCollaborator[]>(
          key,
          prev.map((c) => (c.id === id ? { ...c, status: "revoked" } : c))
        );
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: invalidate,
  });

  const changeRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: CollaboratorRole }) =>
      updateRole(id, role),
    onMutate: async ({ id, role }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<TrackCollaborator[]>(key);
      if (prev) {
        qc.setQueryData<TrackCollaborator[]>(
          key,
          prev.map((c) => (c.id === id ? { ...c, role } : c))
        );
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: invalidate,
  });

  return { invite: inviteCollaborator, revoke, changeRole };
}
