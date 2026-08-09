"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  archiveScene,
  checkScenesSchemaReady,
  createScene,
  declineSceneInvite,
  fetchDiscoverScenes,
  fetchMyInvites,
  fetchMyScenes,
  fetchSceneBySlug,
  joinScene,
  leaveScene,
  seedOwlsNestDemo,
  updateScene,
  uploadSceneBanner,
  uploadSceneEmblem,
  type CreateSceneInput,
  type UpdateSceneInput,
} from "@/lib/api/scenes";
import type { Scene } from "@/lib/types";

export function useScenesSchemaReady() {
  return useQuery({
    queryKey: ["scenes", "schema-ready"],
    queryFn: checkScenesSchemaReady,
    staleTime: 5 * 60_000,
  });
}

export function useMyScenes() {
  return useQuery({
    queryKey: ["scenes", "mine"],
    queryFn: fetchMyScenes,
    staleTime: 15_000,
  });
}

export function useMyInvites() {
  return useQuery({
    queryKey: ["scenes", "invites"],
    queryFn: fetchMyInvites,
    staleTime: 15_000,
  });
}

export function useDiscoverScenes(query: string, excludeSceneIds: string[]) {
  return useQuery({
    queryKey: ["scenes", "discover", query, excludeSceneIds],
    queryFn: () => fetchDiscoverScenes(query, { excludeSceneIds }),
    staleTime: 15_000,
  });
}

export function useScene(slug: string | null) {
  return useQuery({
    queryKey: ["scene", slug],
    queryFn: () => fetchSceneBySlug(slug!),
    enabled: !!slug,
  });
}

function invalidateSceneLists(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["scenes"] });
}

export function useSceneMutations() {
  const qc = useQueryClient();

  const create = useMutation({
    mutationFn: (input: CreateSceneInput) => createScene(input),
    onSuccess: (scene) => {
      qc.setQueryData(["scene", scene.slug], scene);
      invalidateSceneLists(qc);
    },
  });

  const seedDemo = useMutation({
    mutationFn: seedOwlsNestDemo,
    onSuccess: (scene) => {
      qc.setQueryData(["scene", scene.slug], scene);
      invalidateSceneLists(qc);
    },
  });

  const join = useMutation({
    mutationFn: ({ sceneId, profileId }: { sceneId: string; profileId: string }) =>
      joinScene(sceneId, profileId),
    onSuccess: () => invalidateSceneLists(qc),
  });

  const leave = useMutation({
    mutationFn: ({ sceneId, profileId }: { sceneId: string; profileId: string }) =>
      leaveScene(sceneId, profileId),
    onSuccess: () => invalidateSceneLists(qc),
  });

  const declineInvite = useMutation({
    mutationFn: ({ sceneId, profileId }: { sceneId: string; profileId: string }) =>
      declineSceneInvite(sceneId, profileId),
    onSuccess: () => invalidateSceneLists(qc),
  });

  const update = useMutation({
    mutationFn: ({ scene, input }: { scene: Scene; input: UpdateSceneInput }) =>
      updateScene(scene, input),
    onSuccess: (updated) => {
      qc.setQueryData(["scene", updated.slug], updated);
      invalidateSceneLists(qc);
    },
  });

  const archive = useMutation({
    mutationFn: ({ sceneId }: { sceneId: string }) => archiveScene(sceneId),
    onSuccess: () => invalidateSceneLists(qc),
  });

  const uploadBanner = useMutation({
    mutationFn: ({ scene, file }: { scene: Scene; file: File }) =>
      uploadSceneBanner(scene, file),
    onSuccess: (updated) => {
      qc.setQueryData(["scene", updated.slug], updated);
      invalidateSceneLists(qc);
    },
  });

  const uploadEmblem = useMutation({
    mutationFn: ({ scene, file }: { scene: Scene; file: File }) =>
      uploadSceneEmblem(scene, file),
    onSuccess: (updated) => {
      qc.setQueryData(["scene", updated.slug], updated);
      invalidateSceneLists(qc);
    },
  });

  return { create, seedDemo, join, leave, declineInvite, update, archive, uploadBanner, uploadEmblem };
}
