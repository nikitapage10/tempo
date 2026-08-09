"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ensureScenePersona,
  fetchMyScenePersona,
  fetchScenePersonas,
  joinSceneWithPersona,
  updateScenePersona,
} from "@/lib/api/scene-personas";
import {
  archiveSceneSection,
  createSceneGroup,
  createSceneSection,
  fetchSceneGroups,
  fetchSceneSections,
  reorderSceneSections,
  updateSceneSection,
} from "@/lib/api/scene-sections";
import {
  createSceneLibraryItem,
  fetchSceneLibrary,
  fetchScenePage,
  fetchSceneShowcase,
} from "@/lib/api/scene-library";
import { fetchSceneAnalytics, fetchSceneBadges } from "@/lib/api/scene-recognition";

export function useMyScenePersona(sceneId: string | null) {
  return useQuery({
    queryKey: ["scene-persona", sceneId, "mine"],
    queryFn: () => fetchMyScenePersona(sceneId!),
    enabled: !!sceneId,
  });
}

export function useScenePersonas(sceneId: string | null) {
  return useQuery({
    queryKey: ["scene-personas", sceneId],
    queryFn: () => fetchScenePersonas(sceneId!),
    enabled: !!sceneId,
  });
}

export function useSceneSections(sceneId: string | null) {
  return useQuery({
    queryKey: ["scene-sections", sceneId],
    queryFn: () => fetchSceneSections(sceneId!),
    enabled: !!sceneId,
  });
}

export function useSceneGroups(sceneId: string | null) {
  return useQuery({
    queryKey: ["scene-groups", sceneId],
    queryFn: () => fetchSceneGroups(sceneId!),
    enabled: !!sceneId,
  });
}

export function useSceneLibrary(sectionId: string | null) {
  return useQuery({
    queryKey: ["scene-library", sectionId],
    queryFn: () => fetchSceneLibrary(sectionId!),
    enabled: !!sectionId,
  });
}

export function useScenePage(sectionId: string | null) {
  return useQuery({
    queryKey: ["scene-page", sectionId],
    queryFn: () => fetchScenePage(sectionId!),
    enabled: !!sectionId,
  });
}

export function useSceneShowcase(sectionId: string | null) {
  return useQuery({
    queryKey: ["scene-showcase", sectionId],
    queryFn: () => fetchSceneShowcase(sectionId!),
    enabled: !!sectionId,
  });
}

export function useSceneBadges(sceneId: string | null) {
  return useQuery({
    queryKey: ["scene-badges", sceneId],
    queryFn: () => fetchSceneBadges(sceneId!),
    enabled: !!sceneId,
  });
}

export function useSceneAnalytics(sceneId: string | null, days = 30) {
  return useQuery({
    queryKey: ["scene-analytics", sceneId, days],
    queryFn: () => fetchSceneAnalytics(sceneId!, days),
    enabled: !!sceneId,
  });
}

export function useSceneV2Mutations(sceneId: string | null) {
  const qc = useQueryClient();
  const invalidate = () => {
    if (!sceneId) return;
    void qc.invalidateQueries({ queryKey: ["scene-sections", sceneId] });
    void qc.invalidateQueries({ queryKey: ["scene-groups", sceneId] });
    void qc.invalidateQueries({ queryKey: ["scene-personas", sceneId] });
  };

  const ensurePersona = useMutation({ mutationFn: ensureScenePersona, onSuccess: invalidate });
  const updatePersona = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof updateScenePersona>[1] }) =>
      updateScenePersona(id, patch),
    onSuccess: invalidate,
  });
  const join = useMutation({
    mutationFn: ({ sceneId: id, personaId }: { sceneId: string; personaId: string }) =>
      joinSceneWithPersona(id, personaId),
    onSuccess: invalidate,
  });
  const createSection = useMutation({ mutationFn: createSceneSection, onSuccess: invalidate });
  const updateSection = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof updateSceneSection>[1] }) =>
      updateSceneSection(id, patch),
    onSuccess: invalidate,
  });
  const archiveSection = useMutation({ mutationFn: archiveSceneSection, onSuccess: invalidate });
  const reorderSections = useMutation({ mutationFn: reorderSceneSections, onSuccess: invalidate });
  const createGroup = useMutation({ mutationFn: createSceneGroup, onSuccess: invalidate });
  const createLibraryItem = useMutation({
    mutationFn: createSceneLibraryItem,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["scene-library"] }),
  });

  return {
    ensurePersona,
    updatePersona,
    join,
    createSection,
    updateSection,
    archiveSection,
    reorderSections,
    createGroup,
    createLibraryItem,
  };
}
