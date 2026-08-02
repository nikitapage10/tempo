/**
 * Flattens a reviewed import plan into the payload commit_workspace_import()
 * expects (see migration 014).
 *
 * The browser sends the plan it edited plus which items the artist ticked; the
 * server rebuilds the payload from that rather than accepting a ready-made one,
 * so nothing the client invents can reach the database untouched.
 */

import type { WorkspaceImportPlan } from "@/lib/ai/import-plan-schema";

export type CommitSelection = {
  trackRefs: string[];
  projectRefs: string[];
  taskRefs: string[];
};

export type CommitPayload = {
  artistId: string | null;
  spaces: { ref: string; name: string; existingId: string | null }[];
  projects: {
    ref: string;
    name: string;
    spaceRef: string;
    projectType: string;
    description: string | null;
    deadline: string | null;
  }[];
  tracks: {
    ref: string;
    title: string;
    spaceRef: string;
    projectRef: string | null;
    stageName: string | null;
    type: string;
    momentum: string;
    artistAlias: string | null;
    bpm: number | null;
    musicalKey: string | null;
    genre: string | null;
    destination: string | null;
    deadline: string | null;
    nextAction: string | null;
    nextActionDue: string | null;
    blockedReason: string | null;
    waitingOn: string | null;
    tags: string[];
    notes: string | null;
    checklist: string[];
    spotify: SpotifyCommittedMetadata | null;
  }[];
  tasks: {
    ref: string;
    title: string;
    category: string;
    dueDate: string | null;
    notes: string | null;
    trackRef: string | null;
    projectRef: string | null;
  }[];
};

export type SpotifyCommittedMetadata = {
  trackId: string;
  trackUrl: string | null;
  albumId: string;
  albumName: string;
  albumUrl: string | null;
  releaseDate: string | null;
  releaseDatePrecision: string | null;
  artworkUrl: string | null;
  isrc: string | null;
  durationMs: number | null;
  explicit: boolean;
  trackNumber: number | null;
  discNumber: number | null;
  artistNames: string[];
};

/**
 * Collaborator names can't become real collaborators — that needs an email and
 * an invite. They're preserved as a note on the track so the information isn't
 * lost, which is also why TEMPO never claims to have "identified" a credit.
 */
function mergeNotes(notes: string | null, collaborators: string[]): string | null {
  if (collaborators.length === 0) return notes;
  const line = `Mentioned: ${collaborators.join(", ")}`;
  return notes ? `${notes}\n\n${line}` : line;
}

export function toCommitPayload(
  plan: WorkspaceImportPlan,
  selection: CommitSelection,
): CommitPayload {
  const trackSet = new Set(selection.trackRefs);
  const projectSet = new Set(selection.projectRefs);
  const taskSet = new Set(selection.taskRefs);

  const tracks = plan.tracks.filter((t) => trackSet.has(t.ref));
  const projects = plan.projects.filter((p) => projectSet.has(p.ref));
  const tasks = plan.tasks.filter((k) => taskSet.has(k.ref));

  const keptProjectRefs = new Set(projects.map((p) => p.ref));
  const keptTrackRefs = new Set(tracks.map((t) => t.ref));

  // Only create spaces something actually lands in.
  const usedSpaceRefs = new Set([
    ...tracks.map((t) => t.spaceRef),
    ...projects.map((p) => p.spaceRef),
  ]);

  return {
    artistId: null,
    spaces: plan.spaces
      .filter((s) => usedSpaceRefs.has(s.ref))
      .map((s) => ({ ref: s.ref, name: s.name, existingId: s.existingId })),

    projects: projects.map((p) => ({
      ref: p.ref,
      name: p.name,
      spaceRef: p.spaceRef,
      projectType: p.projectType.value ?? "general",
      description: p.description,
      deadline: p.deadline.value,
    })),

    tracks: tracks.map((t) => ({
      ref: t.ref,
      title: t.title,
      spaceRef: t.spaceRef,
      // A track can't point at a project the artist chose not to create.
      projectRef: t.projectRef && keptProjectRefs.has(t.projectRef) ? t.projectRef : null,
      stageName: t.stageName.value,
      type: t.type.value ?? "original",
      momentum: t.momentum.value ?? "active",
      artistAlias: t.artistAlias.value,
      bpm: t.bpm.value,
      musicalKey: t.musicalKey.value,
      genre: t.genre.value,
      destination: t.destination.value,
      deadline: t.deadline.value,
      nextAction: t.nextAction.value,
      nextActionDue: t.nextActionDue.value,
      blockedReason: t.blockedReason.value,
      waitingOn: t.waitingOn.value,
      tags: t.tags,
      notes: mergeNotes(t.notes, t.collaborators),
      checklist: t.checklist,
      spotify: null,
    })),

    tasks: tasks.map((k) => ({
      ref: k.ref,
      title: k.title,
      category: k.category.value ?? "other",
      dueDate: k.dueDate.value,
      notes: k.notes,
      trackRef: k.trackRef && keptTrackRefs.has(k.trackRef) ? k.trackRef : null,
      projectRef: k.projectRef && keptProjectRefs.has(k.projectRef) ? k.projectRef : null,
    })),
  };
}

/** What the confirm screen promises, computed from the same payload that commits. */
export function summarizeCommitPayload(payload: CommitPayload) {
  return {
    spaces: payload.spaces.filter((s) => !s.existingId).length,
    projects: payload.projects.length,
    tracks: payload.tracks.length,
    tasks: payload.tasks.length,
    checklistItems: payload.tracks.reduce((sum, t) => sum + t.checklist.length, 0),
  };
}
