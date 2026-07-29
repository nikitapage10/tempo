"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  attachTaskToProject,
  attachTrackToProject,
  createProject,
  deleteProject,
  fetchProject,
  fetchProjectTasks,
  fetchProjectTracks,
  fetchProjects,
  updateProject,
} from "@/lib/api/projects";
import type { ProjectInsert, ProjectUpdate } from "@/lib/types";

export function useProjects(spaceId: string | null) {
  return useQuery({
    queryKey: ["projects", spaceId],
    queryFn: () => fetchProjects(spaceId),
    enabled: !!spaceId,
  });
}

export function useProject(id: string | null) {
  return useQuery({
    queryKey: ["project", id],
    queryFn: () => fetchProject(id!),
    enabled: !!id,
  });
}

export function useProjectTracks(projectId: string | null) {
  return useQuery({
    queryKey: ["project-tracks", projectId],
    queryFn: () => fetchProjectTracks(projectId!),
    enabled: !!projectId,
  });
}

export function useProjectTasks(projectId: string | null) {
  return useQuery({
    queryKey: ["project-tasks", projectId],
    queryFn: () => fetchProjectTasks(projectId!),
    enabled: !!projectId,
  });
}

export function useProjectMutations() {
  const qc = useQueryClient();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["projects"] });
    qc.invalidateQueries({ queryKey: ["project"] });
    qc.invalidateQueries({ queryKey: ["project-tracks"] });
    qc.invalidateQueries({ queryKey: ["project-tasks"] });
    qc.invalidateQueries({ queryKey: ["tracks"] });
    qc.invalidateQueries({ queryKey: ["tasks"] });
  };

  const create = useMutation({
    mutationFn: (input: ProjectInsert) => createProject(input),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: ProjectUpdate }) =>
      updateProject(id, patch),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteProject(id),
    onSuccess: invalidate,
  });

  const attachTrack = useMutation({
    mutationFn: ({
      trackId,
      projectId,
    }: {
      trackId: string;
      projectId: string | null;
    }) => attachTrackToProject(trackId, projectId),
    onSuccess: invalidate,
  });

  const attachTask = useMutation({
    mutationFn: ({
      taskId,
      projectId,
    }: {
      taskId: string;
      projectId: string | null;
    }) => attachTaskToProject(taskId, projectId),
    onSuccess: invalidate,
  });

  return { create, update, remove, attachTrack, attachTask };
}
