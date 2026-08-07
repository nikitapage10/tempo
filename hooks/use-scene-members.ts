"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchMySceneMembership,
  fetchScenePendingRequests,
  fetchSceneMembers,
  inviteToScene,
  respondToSceneJoinRequest,
  setSceneMemberBanned,
  setSceneMemberRole,
  updateMySceneMembership,
} from "@/lib/api/scene-members";
import type { SceneRole } from "@/lib/types";

export function useSceneMembers(sceneId: string | null) {
  return useQuery({
    queryKey: ["scene-members", sceneId, "active"],
    queryFn: () => fetchSceneMembers(sceneId!),
    enabled: !!sceneId,
    staleTime: 15_000,
  });
}

export function useScenePendingRequests(sceneId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["scene-members", sceneId, "pending"],
    queryFn: () => fetchScenePendingRequests(sceneId!),
    enabled: !!sceneId && enabled,
    staleTime: 10_000,
  });
}

export function useMySceneMembership(sceneId: string | null, profileId: string | null) {
  return useQuery({
    queryKey: ["scene-members", sceneId, "mine", profileId],
    queryFn: () => fetchMySceneMembership(sceneId!, profileId!),
    enabled: !!sceneId && !!profileId,
  });
}

export function useSceneMemberMutations(sceneId: string | null) {
  const qc = useQueryClient();

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["scene-members", sceneId] });
    qc.invalidateQueries({ queryKey: ["scene", sceneId] });
    qc.invalidateQueries({ queryKey: ["scenes"] });
  }

  const respond = useMutation({
    mutationFn: ({ profileId, approve }: { profileId: string; approve: boolean }) =>
      respondToSceneJoinRequest(sceneId!, profileId, approve),
    onSuccess: invalidate,
  });

  const invite = useMutation({
    mutationFn: (profileId: string) => inviteToScene(sceneId!, profileId),
    onSuccess: invalidate,
  });

  const setRole = useMutation({
    mutationFn: ({ profileId, role }: { profileId: string; role: SceneRole }) =>
      setSceneMemberRole(sceneId!, profileId, role),
    onSuccess: invalidate,
  });

  const setBanned = useMutation({
    mutationFn: ({ profileId, banned }: { profileId: string; banned: boolean }) =>
      setSceneMemberBanned(sceneId!, profileId, banned),
    onSuccess: invalidate,
  });

  const updateMine = useMutation({
    mutationFn: ({
      profileId,
      patch,
    }: {
      profileId: string;
      patch: Parameters<typeof updateMySceneMembership>[2];
    }) => updateMySceneMembership(sceneId!, profileId, patch),
    onSuccess: invalidate,
  });

  return { respond, invite, setRole, setBanned, updateMine };
}
