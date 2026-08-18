"use client";

import * as React from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { LayoutGroup, motion } from "framer-motion";
import {
  FolderPlus,
  GripVertical,
  Image as ImageIcon,
  Pause,
  Play,
  Plus,
  Rows2,
  Rows3,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActiveSpace } from "@/components/active-space-provider";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  FilterGroup,
} from "@/components/ui/filter-row";
import { HeaderMenu } from "@/components/ui/header-menu";
import { Input } from "@/components/ui/input";
import { useLayoutMove } from "@/components/ui/layout-item";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/ui/page-header";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { EmptyShaderPanel } from "@/components/shader-empty";
import { SpectraCoverArt } from "@/components/spectra/spectra-cover-art";
import { TrackFormModal } from "@/components/tracks/track-form-modal";
import {
  TrackGroupSection,
  UNGROUPED_DROP_ID,
  groupDropId,
  groupSortId,
  parseGroupDropId,
  parseGroupSortId,
} from "@/components/tracks/track-group-section";
import {
  useGlobalPlayer,
  type PlayerTrack,
} from "@/components/player/global-player-provider";
import { useStages } from "@/hooks/use-stages";
import {
  useTrackListPresetMutations,
  useTrackListPresets,
} from "@/hooks/use-track-list-presets";
import {
  useTrackGroupMutations,
  useTrackGroups,
} from "@/hooks/use-track-groups";
import { TRACK_GROUP_ACCENTS } from "@/lib/api/track-groups";
import { SignedImage } from "@/components/ui/signed-image";
import {
  useProjectMutations,
  useProjects,
} from "@/hooks/use-projects";
import { useTrackMutations, useTracks } from "@/hooks/use-tracks";
import { useVersionsForTracks } from "@/hooks/use-versions";
import { deriveAttentionSignals } from "@/lib/attention/signals";
import { TRACK_TYPES } from "@/lib/constants";
import { assignTracksToGroupOrder } from "@/lib/tracks/bulk-group-assign";
import {
  formatTrackType,
  momentumDotClass,
  typeChipClass,
} from "@/lib/track-style";
import type {
  Track,
  TrackGroup,
  TrackGroupAccent,
  TrackInsert,
  TrackListPreset,
  TrackType,
} from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Solid swatches for the color picker — the group surfaces themselves are
 * washes. "custom" has no fixed class since it's whatever hex was picked;
 * it's rendered separately with an inline background.
 */
const ACCENT_SWATCH: Record<Exclude<TrackGroupAccent, "custom">, string> = {
  ice: "bg-ice",
  amber: "bg-amber",
  violet: "bg-violet",
  ok: "bg-ok",
  warn: "bg-warn",
};

type BuiltinSort = "custom" | "title" | "stage" | "updated" | "deadline";
type SortSelection = BuiltinSort | `preset:${string}`;
type AttentionFilter = "all" | "blocked" | "waiting" | "overdue";

const BUILTIN_SORTS: { value: BuiltinSort; label: string }[] = [
  { value: "custom", label: "Custom" },
  { value: "title", label: "Title" },
  { value: "stage", label: "Stage" },
  { value: "updated", label: "Updated" },
  { value: "deadline", label: "Deadline" },
];

const SORT_STORAGE_KEY = "tempo.tracksSort";
const DENSITY_STORAGE_KEY = "tempo.tracksDensity";

type ListDensity = "comfortable" | "compact";

function readDensity(): ListDensity {
  if (typeof window === "undefined") return "comfortable";
  const raw = localStorage.getItem(DENSITY_STORAGE_KEY);
  return raw === "compact" ? "compact" : "comfortable";
}

function isBuiltinSort(value: string): value is BuiltinSort {
  return BUILTIN_SORTS.some((o) => o.value === value);
}

function isPresetSort(value: SortSelection): value is `preset:${string}` {
  return value.startsWith("preset:");
}

function presetIdFromSort(value: SortSelection): string | null {
  return isPresetSort(value) ? value.slice("preset:".length) : null;
}

function readSortSelection(): SortSelection {
  if (typeof window === "undefined") return "custom";
  const raw = localStorage.getItem(SORT_STORAGE_KEY);
  if (!raw) return "custom";
  if (isBuiltinSort(raw)) return raw;
  if (raw.startsWith("preset:")) return raw as `preset:${string}`;
  return "custom";
}

function trackMatchesAttention(track: Track, filter: AttentionFilter): boolean {
  if (filter === "all") return true;
  const ids = new Set(
    deriveAttentionSignals({ track }).map((s) => s.id)
  );
  if (filter === "blocked") return ids.has("blocked");
  if (filter === "waiting") return ids.has("waiting");
  return ids.has("next-overdue") || ids.has("deadline-approaching");
}

function sortByPreset(tracks: Track[], trackIds: string[]): Track[] {
  const rank = new Map(trackIds.map((id, i) => [id, i]));
  return [...tracks].sort((a, b) => {
    const ra = rank.has(a.id) ? rank.get(a.id)! : 100_000 + a.list_sort;
    const rb = rank.has(b.id) ? rank.get(b.id)! : 100_000 + b.list_sort;
    return ra - rb || a.title.localeCompare(b.title);
  });
}

function sortTracks(
  tracks: Track[],
  selection: SortSelection,
  stageSort: Map<string, number>,
  presets: TrackListPreset[]
): Track[] {
  if (isPresetSort(selection)) {
    const preset = presets.find((p) => p.id === presetIdFromSort(selection));
    if (preset) return sortByPreset(tracks, preset.track_ids);
    // Missing preset — fall back to Custom.
  }

  const list = [...tracks];
  const mode: BuiltinSort =
    !isPresetSort(selection) && isBuiltinSort(selection) ? selection : "custom";

  if (mode === "custom") {
    return list.sort(
      (a, b) => a.list_sort - b.list_sort || a.title.localeCompare(b.title)
    );
  }
  if (mode === "title") {
    return list.sort((a, b) => a.title.localeCompare(b.title));
  }
  if (mode === "stage") {
    return list.sort((a, b) => {
      const sa = a.stage_id ? (stageSort.get(a.stage_id) ?? 9999) : 9999;
      const sb = b.stage_id ? (stageSort.get(b.stage_id) ?? 9999) : 9999;
      return sa - sb || a.title.localeCompare(b.title);
    });
  }
  if (mode === "updated") {
    return list.sort((a, b) =>
      b.updated_at < a.updated_at ? -1 : b.updated_at > a.updated_at ? 1 : 0
    );
  }
  return list.sort((a, b) => {
    if (!a.deadline && !b.deadline) return a.title.localeCompare(b.title);
    if (!a.deadline) return 1;
    if (!b.deadline) return -1;
    return a.deadline < b.deadline
      ? -1
      : a.deadline > b.deadline
        ? 1
        : a.title.localeCompare(b.title);
  });
}

/**
 * Reorder the full custom list when only a filtered subset was dragged,
 * so hidden rows keep their relative places.
 */
function mergeVisibleReorder(
  allOrderedIds: string[],
  nextVisibleIds: string[]
): string[] {
  const visible = new Set(nextVisibleIds);
  const queue = [...nextVisibleIds];
  return allOrderedIds.map((id) => (visible.has(id) ? queue.shift()! : id));
}

type GroupKey = string | null;

function trackGroupKey(track: Track, groups: TrackGroup[]): GroupKey {
  if (
    track.list_group_id &&
    groups.some((g) => g.id === track.list_group_id)
  ) {
    return track.list_group_id;
  }
  return null;
}

type TrackSection = {
  groupId: GroupKey;
  name: string;
  /** Position among the other sections. Groups carry their own; the ungrouped
   *  run borrows the space's `ungrouped_sort`. */
  sort: number;
  tracks: Track[];
};

/**
 * Groups and the ungrouped run, in the order they appear on the page.
 *
 * The ungrouped tracks aren't a group, so they have no row and no sort of their
 * own — their position is `ungroupedSort` on the space, which defaults to -1 so
 * loose tracks sit above every group. Interleaving here rather than always
 * appending is what lets a group be moved over the top of them.
 */
function buildTrackSections(
  tracks: Track[],
  groups: TrackGroup[],
  ungroupedSort: number
): TrackSection[] {
  if (groups.length === 0) {
    return [{ groupId: null, name: "", sort: ungroupedSort, tracks }];
  }

  const byGroup = new Map<GroupKey, Track[]>();
  for (const g of groups) byGroup.set(g.id, []);
  byGroup.set(null, []);

  for (const t of tracks) {
    byGroup.get(trackGroupKey(t, groups))!.push(t);
  }

  const sections: TrackSection[] = groups.map((g) => ({
    groupId: g.id,
    // No heading for the ungrouped run: it isn't a container, so naming it
    // would invent one.
    name: g.name,
    sort: g.sort,
    tracks: byGroup.get(g.id)!,
  }));
  sections.push({
    groupId: null,
    name: "",
    sort: ungroupedSort,
    tracks: byGroup.get(null)!,
  });

  // Stable: ties keep groups ahead of the ungrouped run.
  return sections.sort(
    (a, b) => a.sort - b.sort || (a.groupId === null ? 1 : -1)
  );
}

function resolveDropGroup(
  overId: string,
  tracks: Track[],
  groups: TrackGroup[]
): GroupKey | undefined {
  const fromDrop = parseGroupDropId(overId);
  if (fromDrop !== undefined) {
    if (fromDrop === null) return null;
    return groups.some((g) => g.id === fromDrop) ? fromDrop : undefined;
  }
  const overTrack = tracks.find((t) => t.id === overId);
  if (!overTrack) return undefined;
  return trackGroupKey(overTrack, groups);
}

export default function TracksPage() {
  const router = useRouter();
  const { activeSpace, activeSpaceId, isLoading: spacesLoading } =
    useActiveSpace();
  const stagesQuery = useStages(activeSpaceId);
  const tracksQuery = useTracks(activeSpaceId);
  const presetsQuery = useTrackListPresets(activeSpaceId);
  const groupsQuery = useTrackGroups(activeSpaceId);
  const projectsQuery = useProjects(activeSpaceId);
  const { create, remove, reorder, moveStage } = useTrackMutations(activeSpaceId);
  const { attachTrack } = useProjectMutations();
  const {
    create: createPreset,
    update: updatePreset,
    remove: removePreset,
  } = useTrackListPresetMutations(activeSpaceId);
  const {
    create: createGroup,
    update: updateGroup,
    reorderSections,
    setCover: setGroupCover,
    clearCover: clearGroupCover,
    remove: removeGroup,
  } = useTrackGroupMutations(activeSpaceId);
  const { toast } = useToast();

  const stages = React.useMemo(
    () => stagesQuery.data ?? [],
    [stagesQuery.data]
  );
  const tracks = tracksQuery.data ?? [];
  const presets = presetsQuery.data ?? [];
  const groups = groupsQuery.data ?? [];
  const projects = projectsQuery.data ?? [];
  const stageName = React.useMemo(() => {
    const map = new Map(stages.map((s) => [s.id, s.name]));
    return (id: string | null) => (id ? map.get(id) ?? "—" : "—");
  }, [stages]);
  const stageSort = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const s of stages) map.set(s.id, s.sort);
    return map;
  }, [stages]);

  const [modalOpen, setModalOpen] = React.useState(false);
  const [sortSelection, setSortSelection] =
    React.useState<SortSelection>(readSortSelection);
  const [density, setDensity] = React.useState<ListDensity>(readDensity);
  const [typeFilter, setTypeFilter] = React.useState<TrackType | "all">("all");
  const [tagFilter, setTagFilter] = React.useState<string>("all");
  const [stageFilter, setStageFilter] = React.useState<string>("all");
  const [attentionFilter, setAttentionFilter] =
    React.useState<AttentionFilter>("all");

  const [selecting, setSelecting] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [bulkBusy, setBulkBusy] = React.useState(false);

  const [saveOpen, setSaveOpen] = React.useState(false);
  const [saveName, setSaveName] = React.useState("");
  const [savingOrder, setSavingOrder] = React.useState(false);

  const [groupDialog, setGroupDialog] = React.useState<
    | null
    | { mode: "create" }
    | { mode: "create-from-selection" }
    | { mode: "rename"; group: TrackGroup }
  >(null);
  const [groupName, setGroupName] = React.useState("");
  const [groupAccent, setGroupAccent] =
    React.useState<TrackGroupAccent | null>(null);
  /** Live only while groupAccent === "custom". */
  const [groupAccentHex, setGroupAccentHex] = React.useState("#7fb4ff");
  const [savingGroup, setSavingGroup] = React.useState(false);
  const [coverBusy, setCoverBusy] = React.useState(false);
  const coverInputRef = React.useRef<HTMLInputElement>(null);
  const [deleteGroupTarget, setDeleteGroupTarget] =
    React.useState<TrackGroup | null>(null);
  const [overGroupId, setOverGroupId] = React.useState<GroupKey | undefined>(
    undefined
  );
  const [activeDrag, setActiveDrag] = React.useState<
    | { kind: "track"; track: Track }
    | { kind: "group"; title: string }
    | null
  >(null);

  // Drop a stale preset id from localStorage if it was deleted elsewhere.
  React.useEffect(() => {
    const id = presetIdFromSort(sortSelection);
    if (!id || presetsQuery.isLoading) return;
    if (!presets.some((p) => p.id === id)) {
      setSortSelection("custom");
      localStorage.setItem(SORT_STORAGE_KEY, "custom");
    }
  }, [presets, presetsQuery.isLoading, sortSelection]);

  const allTags = React.useMemo(() => {
    const set = new Set<string>();
    for (const t of tracks) {
      for (const tag of t.tags ?? []) set.add(tag);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [tracks]);

  const filtered = React.useMemo(() => {
    return tracks.filter((t) => {
      if (typeFilter !== "all" && t.type !== typeFilter) return false;
      if (tagFilter !== "all" && !(t.tags ?? []).includes(tagFilter))
        return false;
      if (stageFilter !== "all" && t.stage_id !== stageFilter) return false;
      if (!trackMatchesAttention(t, attentionFilter)) return false;
      return true;
    });
  }, [tracks, typeFilter, tagFilter, stageFilter, attentionFilter]);

  const displayed = React.useMemo(
    () => sortTracks(filtered, sortSelection, stageSort, presets),
    [filtered, sortSelection, stageSort, presets]
  );

  // -1 until migration 044 has been run, which is also the default it installs:
  // loose tracks above the groups.
  const ungroupedSort = activeSpace?.ungrouped_sort ?? -1;

  const sections = React.useMemo(
    () => buildTrackSections(displayed, groups, ungroupedSort),
    [displayed, groups, ungroupedSort]
  );

  const showGroups = groups.length > 0;

  const versionsByTrackQuery = useVersionsForTracks(displayed.map((t) => t.id));
  const { current: nowPlaying, playing, play, toggle } = useGlobalPlayer();

  const playableTracks = React.useMemo(() => {
    const versionsByTrack = versionsByTrackQuery.data;
    const map = new Map<string, PlayerTrack>();
    if (!versionsByTrack) return map;
    for (const track of displayed) {
      const versions = versionsByTrack.get(track.id);
      if (!versions || versions.length === 0) continue;
      const version = versions.find((v) => v.is_current) ?? versions[0];
      map.set(track.id, {
        id: track.id,
        title: track.title,
        artist: track.artist_alias,
        artworkUrl: track.artwork_url,
        fileUrl: version.file_url,
      });
    }
    return map;
  }, [displayed, versionsByTrackQuery.data]);

  const playableQueue = React.useMemo(
    () => displayed.map((t) => playableTracks.get(t.id)).filter((t): t is PlayerTrack => !!t),
    [displayed, playableTracks]
  );

  function handlePlayTrack(track: Track) {
    const playerTrack = playableTracks.get(track.id);
    if (!playerTrack) return;
    if (nowPlaying?.id === track.id) {
      toggle();
    } else {
      play(playerTrack, playableQueue);
    }
  }

  const activePreset = React.useMemo(() => {
    const id = presetIdFromSort(sortSelection);
    return id ? presets.find((p) => p.id === id) ?? null : null;
  }, [sortSelection, presets]);

  const filtersActive =
    typeFilter !== "all" ||
    tagFilter !== "all" ||
    stageFilter !== "all" ||
    attentionFilter !== "all";

  const canDrag = sortSelection === "custom" && !selecting;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  function setSort(selection: SortSelection) {
    setSortSelection(selection);
    localStorage.setItem(SORT_STORAGE_KEY, selection);
  }

  function customOrderedIds(): string[] {
    return sortTracks(tracks, "custom", stageSort, presets).map((t) => t.id);
  }

  async function handleSubmit(values: TrackInsert & { id?: string }) {
    await create.mutateAsync(values);
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exitSelecting() {
    setSelecting(false);
    setSelected(new Set());
  }

  async function handleDeleteSelected() {
    const ids = Array.from(selected);
    setDeleting(true);

    let failed = 0;
    for (const id of ids) {
      try {
        await remove.mutateAsync(id);
      } catch {
        failed += 1;
      }
    }

    setDeleting(false);
    setConfirmDelete(false);
    exitSelecting();

    if (failed === 0) {
      toast(`Deleted ${ids.length} track${ids.length === 1 ? "" : "s"}.`, "ok");
    } else {
      toast(
        `Deleted ${ids.length - failed} of ${ids.length}. ${failed} couldn’t be removed.`
      );
    }
  }

  async function handleMoveSelectedToGroup(targetGroupId: string | null) {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setBulkBusy(true);
    try {
      const orderedTracks = sortTracks(tracks, "custom", stageSort, presets);
      const payload = assignTracksToGroupOrder({
        orderedTracks: orderedTracks.map((t) => ({
          id: t.id,
          list_group_id: t.list_group_id,
        })),
        groupIds: groups.map((g) => g.id),
        selectedIds: ids,
        targetGroupId,
      });
      await reorder.mutateAsync(payload);
      if (sortSelection !== "custom") setSort("custom");
      const label =
        targetGroupId == null
          ? "ungrouped"
          : groups.find((g) => g.id === targetGroupId)?.name ?? "that group";
      toast(
        targetGroupId == null
          ? `Ungrouped ${ids.length} track${ids.length === 1 ? "" : "s"}.`
          : `Moved ${ids.length} to “${label}”.`,
        "ok"
      );
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Couldn’t move those tracks."
      );
    } finally {
      setBulkBusy(false);
    }
  }

  async function handleMoveSelectedToStage(stageId: string) {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setBulkBusy(true);
    let failed = 0;
    for (const id of ids) {
      try {
        await moveStage.mutateAsync({ id, stageId });
      } catch {
        failed += 1;
      }
    }
    setBulkBusy(false);
    const name = stageName(stageId);
    if (failed === 0) {
      toast(
        `Moved ${ids.length} to ${name}. Stage recipes aren’t run on multi-move.`,
        "ok"
      );
    } else {
      toast(
        `Moved ${ids.length - failed} of ${ids.length} to ${name}. ${failed} couldn’t move.`
      );
    }
  }

  async function handleAttachSelectedToProject(projectId: string | null) {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setBulkBusy(true);
    let failed = 0;
    for (const id of ids) {
      try {
        await attachTrack.mutateAsync({ trackId: id, projectId });
      } catch {
        failed += 1;
      }
    }
    setBulkBusy(false);
    if (projectId == null) {
      if (failed === 0) {
        toast(
          `Removed ${ids.length} from their project${ids.length === 1 ? "" : "s"}.`,
          "ok"
        );
      } else {
        toast(
          `Detached ${ids.length - failed} of ${ids.length}. ${failed} couldn’t update.`
        );
      }
      return;
    }
    const name = projects.find((p) => p.id === projectId)?.name ?? "that project";
    if (failed === 0) {
      toast(`Added ${ids.length} to “${name}”.`, "ok");
    } else {
      toast(
        `Added ${ids.length - failed} of ${ids.length} to “${name}”. ${failed} couldn’t update.`
      );
    }
  }

  function openCreateGroupFromSelection() {
    setGroupName("");
    setGroupAccent(null);
    setGroupAccentHex("#7fb4ff");
    setGroupDialog({ mode: "create-from-selection" });
  }

  function selectAllDisplayed() {
    setSelected(new Set(displayed.map((t) => t.id)));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function handleDragStart(event: DragStartEvent) {
    const id = String(event.active.id);
    const groupId = parseGroupSortId(id);
    if (groupId) {
      const group = groups.find((item) => item.id === groupId);
      setActiveDrag(group ? { kind: "group", title: group.name } : null);
      return;
    }
    const track = tracks.find((item) => item.id === id);
    setActiveDrag(track ? { kind: "track", track } : null);
  }

  function handleDragOver(event: DragOverEvent) {
    if (!canDrag || !showGroups) {
      setOverGroupId(undefined);
      return;
    }
    const overId = event.over?.id;
    if (!overId) {
      setOverGroupId(undefined);
      return;
    }
    setOverGroupId(resolveDropGroup(String(overId), tracks, groups));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    try {
      if (!over || active.id === over.id || !canDrag) return;

      const activeId = String(active.id);
      const overId = String(over.id);

    // A whole group was dragged by its handle: reorder the groups themselves
    // rather than anything inside them.
    const draggedGroupId = parseGroupSortId(activeId);
    if (draggedGroupId) {
      const overSection = resolveDropGroup(overId, tracks, groups);
      if (overSection === undefined || overSection === draggedGroupId) return;
      // The ungrouped run is a valid landing place — dropping a group onto it
      // is how you move a group above (or below) your loose tracks.
      const keys = sections.map((s) => s.groupId);
      const from = keys.indexOf(draggedGroupId);
      const to = keys.indexOf(overSection);
      if (from < 0 || to < 0 || from === to) return;
      persistSectionOrder(arrayMove(keys, from, to));
      return;
    }

    if (!showGroups) {
      const visibleIds = displayed.map((t) => t.id);
      const oldIndex = visibleIds.indexOf(activeId);
      const newIndex = visibleIds.indexOf(overId);
      if (oldIndex < 0 || newIndex < 0) return;

      const nextVisible = arrayMove(visibleIds, oldIndex, newIndex);
      const allOrdered = customOrderedIds();
      const merged = mergeVisibleReorder(allOrdered, nextVisible);
      reorder.mutate(merged.map((id, list_sort) => ({ id, list_sort })));
      return;
    }

    const targetGroupId = resolveDropGroup(overId, tracks, groups);
    if (targetGroupId === undefined) return;

    const activeTrack = tracks.find((t) => t.id === activeId);
    if (!activeTrack) return;

    const groupKeys: GroupKey[] = [...groups.map((g) => g.id), null];
    const full = new Map<GroupKey, string[]>();
    const visible = new Map<GroupKey, string[]>();
    for (const k of groupKeys) {
      full.set(k, []);
      visible.set(k, []);
    }
    for (const t of sortTracks(tracks, "custom", stageSort, presets)) {
      full.get(trackGroupKey(t, groups))!.push(t.id);
    }
    for (const t of displayed) {
      visible.get(trackGroupKey(t, groups))!.push(t.id);
    }

    const sourceGroup = trackGroupKey(activeTrack, groups);
    const overIsDroppable = parseGroupDropId(overId) !== undefined;

    if (sourceGroup === targetGroupId && !overIsDroppable) {
      // Same-group reorder onto another track
      const vis = visible.get(sourceGroup)!;
      const oldIndex = vis.indexOf(activeId);
      const newIndex = vis.indexOf(overId);
      if (oldIndex < 0 || newIndex < 0) return;
      const nextVis = arrayMove(vis, oldIndex, newIndex);
      full.set(
        sourceGroup,
        mergeVisibleReorder(full.get(sourceGroup)!, nextVis)
      );
    } else if (sourceGroup === targetGroupId && overIsDroppable) {
      // Dropped on own group chrome — no-op
      return;
    } else {
      full.set(
        sourceGroup,
        full.get(sourceGroup)!.filter((id) => id !== activeId)
      );
      const targetFull = [...full.get(targetGroupId)!];
      const targetVis = visible
        .get(targetGroupId)!
        .filter((id) => id !== activeId);

      let insertAt: number;
      if (overIsDroppable || !targetFull.includes(overId)) {
        if (targetVis.length === 0) insertAt = targetFull.length;
        else {
          const lastId = targetVis[targetVis.length - 1]!;
          const idx = targetFull.indexOf(lastId);
          insertAt = idx >= 0 ? idx + 1 : targetFull.length;
        }
      } else {
        const idx = targetFull.indexOf(overId);
        insertAt = idx >= 0 ? idx : targetFull.length;
      }
      targetFull.splice(insertAt, 0, activeId);
      full.set(targetGroupId, targetFull);
    }

    const flattened: {
      id: string;
      list_sort: number;
      list_group_id: string | null;
    }[] = [];
    let i = 0;
    for (const k of groupKeys) {
      for (const id of full.get(k)!) {
        flattened.push({ id, list_sort: i++, list_group_id: k });
      }
    }
    reorder.mutate(flattened);
    } finally {
      setOverGroupId(undefined);
      setActiveDrag(null);
    }
  }

  async function handleSaveOrder() {
    const name = saveName.trim();
    if (!name || !activeSpaceId) return;
    setSavingOrder(true);
    try {
      const preset = await createPreset.mutateAsync({
        name,
        trackIds: customOrderedIds(),
      });
      setSaveOpen(false);
      setSaveName("");
      setSort(`preset:${preset.id}`);
      toast(`Saved “${preset.name}” — it’s in Sort now.`, "ok");
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : err &&
              typeof err === "object" &&
              "message" in err &&
              typeof (err as { message: unknown }).message === "string"
            ? (err as { message: string }).message
            : "Couldn’t save that order.";
      toast(message);
    } finally {
      setSavingOrder(false);
    }
  }

  async function handleUpdateActivePreset() {
    if (!activePreset) return;
    try {
      await updatePreset.mutateAsync({
        id: activePreset.id,
        trackIds: customOrderedIds(),
      });
      toast(`Updated “${activePreset.name}”.`, "ok");
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Couldn’t update that order."
      );
    }
  }

  async function handleDeletePreset(preset: TrackListPreset) {
    try {
      await removePreset.mutateAsync(preset.id);
      if (presetIdFromSort(sortSelection) === preset.id) {
        setSort("custom");
      }
      toast(`Removed “${preset.name}” from Sort.`);
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Couldn’t remove that order."
      );
    }
  }

  async function handleUsePresetAsCustom() {
    if (!activePreset) return;
    const ordered = sortByPreset(tracks, activePreset.track_ids).map((t) => t.id);
    // Append any tracks missing from the snapshot so nothing disappears.
    const seen = new Set(ordered);
    for (const t of customOrderedIds()) {
      if (!seen.has(t)) ordered.push(t);
    }
    try {
      await reorder.mutateAsync(
        ordered.map((id, list_sort) => ({ id, list_sort }))
      );
      setSort("custom");
      toast("Applied as your Custom order — drag to tweak.", "ok");
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Couldn’t apply that order."
      );
    }
  }

  function openCreateGroup() {
    setGroupName("");
    setGroupAccent(null);
    setGroupAccentHex("#7fb4ff");
    setGroupDialog({ mode: "create" });
  }

  function openRenameGroup(group: TrackGroup) {
    setGroupName(group.name);
    setGroupAccent(group.accent_color);
    if (group.accent_hex) setGroupAccentHex(group.accent_hex);
    setGroupDialog({ mode: "rename", group });
  }

  /** The cover is saved immediately — it isn't part of the Save/Cancel pair,
   *  because an upload isn't something to hold in memory until you confirm. */
  async function handleCoverFile(file: File) {
    if (groupDialog?.mode !== "rename") return;
    setCoverBusy(true);
    try {
      const updated = await setGroupCover.mutateAsync({
        group: groupDialog.group,
        file,
      });
      setGroupDialog({ mode: "rename", group: updated });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn’t upload that image.");
    } finally {
      setCoverBusy(false);
    }
  }

  async function handleClearCover() {
    if (groupDialog?.mode !== "rename") return;
    setCoverBusy(true);
    try {
      const updated = await clearGroupCover.mutateAsync(groupDialog.group);
      setGroupDialog({ mode: "rename", group: updated });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn’t remove that cover.");
    } finally {
      setCoverBusy(false);
    }
  }

  async function handleSaveGroup() {
    const name = groupName.trim();
    if (!name || !groupDialog) return;
    setSavingGroup(true);
    try {
      if (
        groupDialog.mode === "create" ||
        groupDialog.mode === "create-from-selection"
      ) {
        const group = await createGroup.mutateAsync(name);
        if (groupAccent) {
          await updateGroup.mutateAsync({
            id: group.id,
            accentColor: groupAccent,
            accentHex: groupAccent === "custom" ? groupAccentHex : null,
          });
        }
        if (groupDialog.mode === "create-from-selection" && selected.size > 0) {
          const ids = Array.from(selected);
          const orderedTracks = sortTracks(tracks, "custom", stageSort, presets);
          const payload = assignTracksToGroupOrder({
            orderedTracks: orderedTracks.map((t) => ({
              id: t.id,
              list_group_id: t.list_group_id,
            })),
            groupIds: groups.map((g) => g.id),
            selectedIds: ids,
            targetGroupId: group.id,
          });
          await reorder.mutateAsync(payload);
          if (sortSelection !== "custom") setSort("custom");
          toast(
            `Grouped ${ids.length} into “${group.name}”.`,
            "ok"
          );
        } else {
          toast(`Created “${group.name}”. Drag tracks into it.`, "ok");
        }
      } else {
        await updateGroup.mutateAsync({
          id: groupDialog.group.id,
          name,
          accentColor: groupAccent,
          accentHex: groupAccent === "custom" ? groupAccentHex : null,
        });
        toast(`Saved “${name}”.`, "ok");
      }
      setGroupDialog(null);
      setGroupName("");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn’t save that group.");
    } finally {
      setSavingGroup(false);
    }
  }

  async function handleDeleteGroup() {
    if (!deleteGroupTarget) return;
    const name = deleteGroupTarget.name;
    try {
      await removeGroup.mutateAsync(deleteGroupTarget.id);
      setDeleteGroupTarget(null);
      toast(`Removed “${name}” — tracks are ungrouped.`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn’t remove that group.");
    }
  }

  /**
   * Persist one ordered list of section keys, `null` being the ungrouped run.
   *
   * Everything is renumbered from zero on each move so the group sorts and the
   * space's `ungrouped_sort` can never end up describing two different orders.
   */
  function persistSectionOrder(keys: GroupKey[]) {
    const groupSorts: { id: string; sort: number }[] = [];
    let ungrouped = -1;
    keys.forEach((key, sort) => {
      if (key === null) ungrouped = sort;
      else groupSorts.push({ id: key, sort });
    });
    reorderSections.mutate({ groups: groupSorts, ungroupedSort: ungrouped });
  }

  function moveSection(groupId: GroupKey, direction: -1 | 1) {
    const keys = sections.map((s) => s.groupId);
    const index = keys.indexOf(groupId);
    const swapWith = index + direction;
    if (index < 0 || swapWith < 0 || swapWith >= keys.length) return;
    persistSectionOrder(arrayMove(keys, index, swapWith));
  }

  const loading = spacesLoading || tracksQuery.isLoading;
  const selectedTracks = tracks.filter((t) => selected.has(t.id));
  const densityListClass = density === "compact" ? "space-y-1" : "space-y-2";

  function renderTrackRow(track: Track) {
    return (
      <SortableTrackRow
        key={track.id}
        track={track}
        stageLabel={stageName(track.stage_id)}
        selecting={selecting}
        selected={selected.has(track.id)}
        canDrag={canDrag}
        compact={density === "compact"}
        onToggleSelect={() => toggleSelected(track.id)}
        onOpen={() => router.push(`/track/${track.id}`)}
        playable={playableTracks.has(track.id)}
        isPlaying={nowPlaying?.id === track.id && playing}
        onPlay={() => handlePlayTrack(track)}
      />
    );
  }

  return (
    <div>
      <PageHeader
        title="Tracks"
        subtitle={`Everything in ${activeSpace?.name ?? "this space"}.`}
        actions={
          selecting ? (
            <>
              <span className="font-data text-xs text-text-lo">
                {selected.size} selected
              </span>
              {displayed.length > 0 ? (
                <button
                  type="button"
                  disabled={bulkBusy || deleting}
                  onClick={
                    selected.size === displayed.length
                      ? clearSelection
                      : selectAllDisplayed
                  }
                  className="text-xs text-ice hover:underline disabled:opacity-40"
                >
                  {selected.size === displayed.length
                    ? "Clear"
                    : "Select all"}
                </button>
              ) : null}
              <HeaderMenu label="Group" panelWidth={260}>
                <FilterGroup label="Move to" stacked>
                  {groups.map((g) => (
                    <Chip
                      key={g.id}
                      size="sm"
                      disabled={bulkBusy || selected.size === 0}
                      onClick={() => void handleMoveSelectedToGroup(g.id)}
                    >
                      {g.name}
                    </Chip>
                  ))}
                  <Chip
                    size="sm"
                    disabled={bulkBusy || selected.size === 0}
                    onClick={() => void handleMoveSelectedToGroup(null)}
                  >
                    Ungroup
                  </Chip>
                </FilterGroup>
                <Button
                  size="sm"
                  variant="secondary"
                  className="w-full"
                  disabled={bulkBusy || selected.size === 0}
                  onClick={openCreateGroupFromSelection}
                >
                  <FolderPlus className="size-3.5" />
                  New group with these
                </Button>
              </HeaderMenu>
              <HeaderMenu label="Stage" panelWidth={240}>
                <FilterGroup label="Move to" stacked>
                  {stages.map((s) => (
                    <Chip
                      key={s.id}
                      size="sm"
                      disabled={bulkBusy || selected.size === 0}
                      onClick={() => void handleMoveSelectedToStage(s.id)}
                    >
                      {s.name}
                    </Chip>
                  ))}
                </FilterGroup>
                <p className="text-[11px] leading-snug text-text-lo/80">
                  Recipes stay off for multi-move — open a track to run one.
                </p>
              </HeaderMenu>
              <HeaderMenu label="Project" panelWidth={260}>
                <FilterGroup label="Add to" stacked>
                  {projects.length === 0 ? (
                    <p className="text-xs text-text-lo">No projects yet.</p>
                  ) : (
                    projects.map((p) => (
                      <Chip
                        key={p.id}
                        size="sm"
                        disabled={bulkBusy || selected.size === 0}
                        onClick={() =>
                          void handleAttachSelectedToProject(p.id)
                        }
                      >
                        {p.name}
                      </Chip>
                    ))
                  )}
                </FilterGroup>
                <Chip
                  size="sm"
                  disabled={bulkBusy || selected.size === 0}
                  onClick={() => void handleAttachSelectedToProject(null)}
                >
                  Remove from project
                </Chip>
              </HeaderMenu>
              <Button
                size="sm"
                variant="destructive"
                disabled={selected.size === 0 || bulkBusy || deleting}
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="size-3.5" />
                Delete
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={bulkBusy || deleting}
                onClick={exitSelecting}
              >
                <X className="size-3.5" />
                Done
              </Button>
            </>
          ) : (
            <>
              {tracks.length > 0 ? (
                <>
                  <HeaderMenu
                    label="Sort"
                    active={sortSelection !== "custom"}
                    summary={
                      activePreset
                        ? activePreset.name
                        : sortSelection !== "custom" &&
                            !isPresetSort(sortSelection)
                          ? BUILTIN_SORTS.find((o) => o.value === sortSelection)
                              ?.label
                          : null
                    }
                  >
                    <FilterGroup label="Built-in" stacked>
                      {BUILTIN_SORTS.map((opt) => (
                        <Chip
                          key={opt.value}
                          size="sm"
                          active={sortSelection === opt.value}
                          onClick={() => setSort(opt.value)}
                        >
                          {opt.label}
                        </Chip>
                      ))}
                    </FilterGroup>
                    {presets.length > 0 ? (
                      <FilterGroup label="Saved" stacked>
                        {presets.map((preset) => (
                          <span
                            key={preset.id}
                            className={cn(
                              "inline-flex items-center gap-0.5 rounded-chip border text-xs",
                              sortSelection === `preset:${preset.id}`
                                ? "border-ice/40 bg-ice/15 text-ice"
                                : "border-line bg-bg-2 text-text-lo"
                            )}
                          >
                            <button
                              type="button"
                              onClick={() => setSort(`preset:${preset.id}`)}
                              className="px-2 py-0.5 hover:text-text-hi"
                            >
                              {preset.name}
                            </button>
                            <button
                              type="button"
                              aria-label={`Remove ${preset.name}`}
                              title="Remove from Sort"
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleDeletePreset(preset);
                              }}
                              className="pr-1.5 text-text-lo/60 hover:text-warn"
                            >
                              <X className="size-3" />
                            </button>
                          </span>
                        ))}
                      </FilterGroup>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        setSaveName("");
                        setSaveOpen(true);
                      }}
                      className="self-start text-xs text-ice hover:underline"
                    >
                      Save current Custom order…
                    </button>
                  </HeaderMenu>

                  <HeaderMenu
                    label="Filter"
                    panelWidth={320}
                    active={filtersActive}
                    summary={
                      filtersActive
                        ? String(
                            [
                              typeFilter !== "all",
                              stageFilter !== "all",
                              tagFilter !== "all",
                              attentionFilter !== "all",
                            ].filter(Boolean).length
                          )
                        : null
                    }
                    onClear={() => {
                      setTypeFilter("all");
                      setTagFilter("all");
                      setStageFilter("all");
                      setAttentionFilter("all");
                    }}
                  >
                    <FilterGroup label="Type" stacked>
                      <Chip
                        size="sm"
                        active={typeFilter === "all"}
                        onClick={() => setTypeFilter("all")}
                      >
                        All
                      </Chip>
                      {TRACK_TYPES.map((t) => (
                        <Chip
                          key={t.value}
                          size="sm"
                          active={typeFilter === t.value}
                          onClick={() => setTypeFilter(t.value)}
                        >
                          {t.label}
                        </Chip>
                      ))}
                    </FilterGroup>

                    {stages.length > 0 ? (
                      <FilterGroup label="Stage" stacked>
                        <Chip
                          size="sm"
                          active={stageFilter === "all"}
                          onClick={() => setStageFilter("all")}
                        >
                          All
                        </Chip>
                        {stages.map((s) => (
                          <Chip
                            key={s.id}
                            size="sm"
                            active={stageFilter === s.id}
                            onClick={() => setStageFilter(s.id)}
                          >
                            {s.name}
                          </Chip>
                        ))}
                      </FilterGroup>
                    ) : null}

                    {allTags.length > 0 ? (
                      <FilterGroup label="Tag" stacked>
                        <Chip
                          size="sm"
                          active={tagFilter === "all"}
                          onClick={() => setTagFilter("all")}
                        >
                          All
                        </Chip>
                        {allTags.map((tag) => (
                          <Chip
                            key={tag}
                            size="sm"
                            active={tagFilter === tag}
                            onClick={() => setTagFilter(tag)}
                          >
                            {tag}
                          </Chip>
                        ))}
                      </FilterGroup>
                    ) : null}

                    <FilterGroup label="Show" stacked>
                      {(
                        [
                          ["all", "All"],
                          ["blocked", "Blocked"],
                          ["waiting", "Waiting"],
                          ["overdue", "Overdue"],
                        ] as const
                      ).map(([value, label]) => (
                        <Chip
                          key={value}
                          size="sm"
                          active={attentionFilter === value}
                          onClick={() => setAttentionFilter(value)}
                        >
                          {label}
                        </Chip>
                      ))}
                    </FilterGroup>
                  </HeaderMenu>

                  <div
                    role="group"
                    aria-label="List density"
                    className="flex items-center gap-0.5 rounded-input border border-line bg-bg-2/60 p-0.5"
                  >
                    {(
                      [
                        ["comfortable", Rows2, "Comfortable"],
                        ["compact", Rows3, "Compact"],
                      ] as const
                    ).map(([value, Icon, label]) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={density === value}
                        title={label}
                        onClick={() => {
                          setDensity(value);
                          localStorage.setItem(DENSITY_STORAGE_KEY, value);
                        }}
                        className={cn(
                          "rounded-[6px] p-1.5 transition-colors duration-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice",
                          density === value
                            ? "bg-bg-1 text-ice shadow-e1"
                            : "text-text-lo hover:text-text-hi"
                        )}
                      >
                        <Icon className="size-3.5" strokeWidth={1.75} />
                        <span className="sr-only">{label}</span>
                      </button>
                    ))}
                  </div>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={openCreateGroup}
                  >
                    <FolderPlus className="size-3.5" />
                    Group
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelecting(true)}
                  >
                    Select
                  </Button>
                </>
              ) : null}
              <Button
                size="sm"
                disabled={!activeSpaceId || stages.length === 0}
                onClick={() => setModalOpen(true)}
              >
                <Plus className="size-3.5" />
                Track
              </Button>
            </>
          )
        }
      />

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-card border border-line bg-bg-1"
            />
          ))}
        </div>
      ) : tracks.length === 0 ? (
        <EmptyShaderPanel
          title="No tracks yet"
          copy="Start a track and park it on the board — or bring in the catalog you already have."
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button onClick={() => setModalOpen(true)}>
                <Plus className="size-3.5" />
                Start a track
              </Button>
              <Button variant="secondary" asChild>
                <Link href="/import">Bring your music in</Link>
              </Button>
            </div>
          }
        />
      ) : displayed.length === 0 ? (
        <div className="panel-quiet border-dashed px-4 py-10 text-center">
          <p className="text-sm text-text-lo">Nothing matches these filters.</p>
          <button
            type="button"
            onClick={() => {
              setTypeFilter("all");
              setTagFilter("all");
              setStageFilter("all");
              setAttentionFilter("all");
            }}
            className="mt-2 text-xs text-ice hover:underline"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <section className="panel p-3 sm:p-4">
          {sortSelection === "custom" && !selecting ? (
            <p className="mb-2 text-xs text-text-lo/70">
              {showGroups
                ? "Drag to rearrange or move between groups · "
                : "Drag to rearrange · "}
              <button
                type="button"
                className="text-ice hover:underline"
                onClick={() => {
                  setSaveName("");
                  setSaveOpen(true);
                }}
              >
                Save
              </button>{" "}
              adds the order to Sort
              {!showGroups ? (
                <>
                  {" · "}
                  <button
                    type="button"
                    className="text-ice hover:underline"
                    onClick={openCreateGroup}
                  >
                    New group
                  </button>
                </>
              ) : null}
            </p>
          ) : null}
          {activePreset ? (
            <p className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-lo/70">
              <span>“{activePreset.name}”</span>
              <button
                type="button"
                className="text-ice hover:underline"
                onClick={() => void handleUsePresetAsCustom()}
              >
                Use as Custom
              </button>
              <button
                type="button"
                className="text-ice hover:underline"
                onClick={() => void handleUpdateActivePreset()}
              >
                Overwrite
              </button>
            </p>
          ) : null}
          {!isPresetSort(sortSelection) && sortSelection !== "custom" ? (
            <p className="mb-2 text-xs text-text-lo/70">
              Sorted by{" "}
              {BUILTIN_SORTS.find((o) => o.value === sortSelection)?.label}
            </p>
          ) : null}

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={() => {
              setOverGroupId(undefined);
              setActiveDrag(null);
            }}
          >
            <LayoutGroup id="tempo-tracks-list">
            <SortableContext
              items={displayed.map((t) => t.id)}
              strategy={verticalListSortingStrategy}
              disabled={!canDrag}
            >
              {showGroups ? (
                <div className={cn(density === "compact" ? "space-y-4" : "space-y-5")}>
                  {sections.map((section) => {
                    const dropId =
                      section.groupId === null
                        ? UNGROUPED_DROP_ID
                        : groupDropId(section.groupId);
                    const sectionIndex = sections.findIndex(
                      (s) => s.groupId === section.groupId
                    );
                    const group =
                      section.groupId === null
                        ? null
                        : groups.find((g) => g.id === section.groupId) ?? null;

                    return (
                      <TrackGroupSection
                        key={dropId}
                        dropId={dropId}
                        title={section.name || undefined}
                        sortId={group ? groupSortId(group.id) : undefined}
                        coverUrl={group?.cover_url ?? null}
                        accent={group?.accent_color ?? null}
                        accentHex={group?.accent_hex ?? null}
                        count={section.tracks.length}
                        canDrag={canDrag}
                        densityClass={densityListClass}
                        isOver={overGroupId === section.groupId}
                        onRename={
                          group ? () => openRenameGroup(group) : undefined
                        }
                        onDelete={
                          group ? () => setDeleteGroupTarget(group) : undefined
                        }
                        onMoveUp={
                          group && sectionIndex > 0
                            ? () => moveSection(section.groupId, -1)
                            : undefined
                        }
                        onMoveDown={
                          group && sectionIndex < sections.length - 1
                            ? () => moveSection(section.groupId, 1)
                            : undefined
                        }
                      >
                        {section.tracks.map((track) => renderTrackRow(track))}
                      </TrackGroupSection>
                    );
                  })}
                </div>
              ) : (
                <ul className={densityListClass}>
                  {displayed.map((track) => renderTrackRow(track))}
                </ul>
              )}
            </SortableContext>
            <DragOverlay dropAnimation={null}>
              {activeDrag?.kind === "track" ? (
                <TrackRowView
                  track={activeDrag.track}
                  stageLabel={stageName(activeDrag.track.stage_id)}
                  selecting={false}
                  selected={false}
                  canDrag={canDrag}
                  compact={density === "compact"}
                  overlay
                  onToggleSelect={() => {}}
                  onOpen={() => {}}
                  playable={false}
                  isPlaying={false}
                  onPlay={() => {}}
                />
              ) : activeDrag?.kind === "group" ? (
                <div className="cursor-grabbing rounded-card border border-ice/40 bg-bg-1 px-3 py-2.5 shadow-raise">
                  <p className="font-display text-sm text-text-hi">{activeDrag.title}</p>
                </div>
              ) : null}
            </DragOverlay>
            </LayoutGroup>
          </DndContext>
        </section>
      )}

      {activeSpaceId ? (
        <TrackFormModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          spaceId={activeSpaceId}
          stages={stages}
          onSubmit={handleSubmit}
        />
      ) : null}

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent
          title="Save this order"
          description="Names the current Custom arrangement and adds it to Sort so you can come back to it."
          onClose={() => setSaveOpen(false)}
        >
          <label className="mt-3 block">
            <span className="label-mono">Name</span>
            <Input
              className="mt-1.5"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="e.g. Release stack"
              maxLength={60}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleSaveOrder();
                }
              }}
            />
          </label>
          <div className="mt-4 flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={savingOrder}
              onClick={() => setSaveOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={savingOrder || !saveName.trim()}
              onClick={() => void handleSaveOrder()}
            >
              {savingOrder ? "Saving…" : "Save to Sort"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent
          title={`Delete ${selected.size} track${selected.size === 1 ? "" : "s"}?`}
          description="Their bounces, comments, checklists, and session history go too. This can't be undone."
          onClose={() => setConfirmDelete(false)}
        >
          <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto">
            {selectedTracks.map((track) => (
              <li
                key={track.id}
                className="well truncate px-3 py-1.5 text-xs text-text-hi"
              >
                {track.title}
              </li>
            ))}
          </ul>

          <div className="mt-4 flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={deleting}
              onClick={() => setConfirmDelete(false)}
            >
              Keep them
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleting}
              onClick={() => void handleDeleteSelected()}
            >
              {deleting
                ? "Deleting…"
                : `Delete ${selected.size} track${selected.size === 1 ? "" : "s"}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={groupDialog != null}
        onOpenChange={(open) => {
          if (!open) setGroupDialog(null);
        }}
      >
        <DialogContent
          title={
            groupDialog?.mode === "rename"
              ? "Edit group"
              : groupDialog?.mode === "create-from-selection"
                ? "New group with selection"
                : "New group"
          }
          description={
            groupDialog?.mode === "rename"
              ? "Just how this reads on the Tracks list — projects stay as they are."
              : groupDialog?.mode === "create-from-selection"
                ? `Creates a group and puts the ${selected.size} selected track${selected.size === 1 ? "" : "s"} in it. Separate from projects.`
                : "An album, EP, playlist, or any bucket you want on Tracks. Separate from projects."
          }
          onClose={() => setGroupDialog(null)}
        >
          <label className="mt-3 block">
            <span className="label-mono">Name</span>
            <Input
              className="mt-1.5"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="e.g. Echoes EP"
              maxLength={60}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleSaveGroup();
                }
              }}
            />
          </label>

          <div className="mt-4">
            <span className="label-mono">Color</span>
            <p className="mt-1 text-xs text-text-lo/70">
              Optional. Tints the group so it stands apart from the others.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setGroupAccent(null)}
                aria-pressed={groupAccent === null}
                className={cn(
                  "rounded-chip border px-2.5 py-1 text-xs transition-colors",
                  groupAccent === null
                    ? "border-text-hi/60 text-text-hi"
                    : "border-line text-text-lo hover:text-text-hi"
                )}
              >
                None
              </button>
              {TRACK_GROUP_ACCENTS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setGroupAccent(value)}
                  aria-pressed={groupAccent === value}
                  aria-label={label}
                  title={label}
                  className={cn(
                    "size-6 rounded-full border-2 transition-transform",
                    ACCENT_SWATCH[value],
                    groupAccent === value
                      ? "scale-110 border-text-hi"
                      : "border-transparent hover:scale-105"
                  )}
                />
              ))}
              {/* A text label makes this read as an action instead of a sixth
                  preset swatch. The native picker covers the chip invisibly,
                  so clicking Custom opens it immediately. */}
              <span
                className={cn(
                  "relative inline-flex rounded-chip border px-2.5 py-1 text-xs transition-colors",
                  groupAccent === "custom"
                    ? "border-text-hi/60 text-text-hi"
                    : "border-line text-text-lo hover:text-text-hi"
                )}
              >
                Custom
                <input
                  type="color"
                  aria-label="Pick a custom color"
                  value={groupAccentHex}
                  onChange={(e) => {
                    setGroupAccentHex(e.target.value);
                    setGroupAccent("custom");
                  }}
                  className="absolute inset-0 size-full cursor-pointer opacity-0"
                />
              </span>
            </div>
          </div>

          {/* Cover art needs a saved group to attach to, so it only appears
              once the group exists. */}
          {groupDialog?.mode === "rename" ? (
            <div className="mt-4">
              <span className="label-mono">Cover</span>
              <div className="mt-2 flex items-center gap-3">
                {groupDialog.group.cover_url ? (
                  <SignedImage
                    path={groupDialog.group.cover_url}
                    alt=""
                    className="size-14 shrink-0 rounded-card object-cover"
                  />
                ) : (
                  <div
                    aria-hidden
                    className="flex size-14 shrink-0 items-center justify-center rounded-card border border-dashed border-line/70 text-text-lo/50"
                  >
                    <ImageIcon className="size-4" />
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={coverBusy}
                    onClick={() => coverInputRef.current?.click()}
                  >
                    {coverBusy
                      ? "Uploading…"
                      : groupDialog.group.cover_url
                        ? "Replace"
                        : "Add cover"}
                  </Button>
                  {groupDialog.group.cover_url ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={coverBusy}
                      onClick={() => void handleClearCover()}
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>
              </div>
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void handleCoverFile(file);
                }}
              />
            </div>
          ) : null}

          <div className="mt-5 flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={savingGroup}
              onClick={() => setGroupDialog(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={savingGroup || !groupName.trim()}
              onClick={() => void handleSaveGroup()}
            >
              {savingGroup
                ? "Saving…"
                : groupDialog?.mode === "rename"
                  ? "Save"
                  : "Create group"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteGroupTarget != null}
        onOpenChange={(open) => {
          if (!open) setDeleteGroupTarget(null);
        }}
      >
        <DialogContent
          title={
            deleteGroupTarget
              ? `Remove “${deleteGroupTarget.name}”?`
              : "Remove group?"
          }
          description="Tracks in it stay in your catalog — they just move back to Ungrouped. Nothing is deleted."
          onClose={() => setDeleteGroupTarget(null)}
        >
          <div className="mt-4 flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDeleteGroupTarget(null)}
            >
              Keep group
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleDeleteGroup()}
            >
              Remove group
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SortableTrackRow({
  track,
  stageLabel,
  selecting,
  selected,
  canDrag,
  compact,
  onToggleSelect,
  onOpen,
  playable,
  isPlaying,
  onPlay,
}: {
  track: Track;
  stageLabel: string;
  selecting: boolean;
  selected: boolean;
  canDrag: boolean;
  compact?: boolean;
  onToggleSelect: () => void;
  onOpen: () => void;
  playable: boolean;
  isPlaying: boolean;
  onPlay: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useSortable({
    id: track.id,
    disabled: !canDrag,
    animateLayoutChanges: () => false,
  });
  const layoutMove = useLayoutMove(`tracks-row-${track.id}`);

  return (
    <motion.li
      ref={setNodeRef}
      {...layoutMove}
      className={cn(isDragging && "relative z-10 opacity-40")}
    >
      <TrackRowView
        track={track}
        stageLabel={stageLabel}
        selecting={selecting}
        selected={selected}
        canDrag={canDrag}
        compact={compact}
        onToggleSelect={onToggleSelect}
        onOpen={onOpen}
        playable={playable}
        isPlaying={isPlaying}
        onPlay={onPlay}
        dragHandle={{ attributes, listeners }}
      />
    </motion.li>
  );
}

function TrackRowView({
  track,
  stageLabel,
  selecting,
  selected,
  canDrag,
  compact,
  overlay,
  onToggleSelect,
  onOpen,
  playable,
  isPlaying,
  onPlay,
  dragHandle,
}: {
  track: Track;
  stageLabel: string;
  selecting: boolean;
  selected: boolean;
  canDrag: boolean;
  compact?: boolean;
  overlay?: boolean;
  onToggleSelect: () => void;
  onOpen: () => void;
  playable: boolean;
  isPlaying: boolean;
  onPlay: () => void;
  dragHandle?: {
    attributes: object;
    listeners?: object;
  };
}) {
  const meta: string[] = [];
  if (track.bpm != null) meta.push(`${track.bpm} BPM`);
  if (track.musical_key) meta.push(track.musical_key);

  const blocked = !!track.blocked_reason?.trim();
  const showHandle = canDrag || overlay;

  return (
    <div
      className={cn(overlay && "cursor-grabbing shadow-raise")}
    >
      <SpotlightCard
        tone={blocked ? "warn" : "ramp"}
        radius={compact ? 10 : 12}
        size={compact ? 160 : 240}
      >
        {compact ? (
          <div
            className={cn(
              "well relative flex w-full items-center gap-2 px-2 py-1 text-left",
              selecting && selected && "!border-ice/40 !bg-ice/5",
              overlay && "ring-1 ring-ice/60"
            )}
          >
            {showHandle ? (
              overlay ? (
                <span className="p-0.5 text-text-lo" aria-hidden>
                  <GripVertical className="size-3.5" />
                </span>
              ) : (
                <button
                  type="button"
                  className="cursor-grab touch-none p-0.5 text-text-lo active:cursor-grabbing"
                  aria-label={`Reorder ${track.title}`}
                  {...dragHandle?.attributes}
                  {...dragHandle?.listeners}
                >
                  <GripVertical className="size-3.5" />
                </button>
              )
            ) : null}

            {playable ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onPlay();
                }}
                aria-label={isPlaying ? `Pause ${track.title}` : `Play ${track.title}`}
                className="shrink-0 text-text-lo transition-colors duration-hover hover:text-ice"
              >
                {isPlaying ? (
                  <Pause className="size-3" fill="currentColor" />
                ) : (
                  <Play className="size-3" fill="currentColor" />
                )}
              </button>
            ) : null}

            <button
              type="button"
              aria-pressed={selecting ? selected : undefined}
              onClick={() => (selecting ? onToggleSelect() : onOpen())}
              className="flex min-w-0 flex-1 items-center gap-2 text-left"
            >
              {selecting ? (
                <span
                  aria-hidden
                  className={cn(
                    "flex size-3.5 shrink-0 items-center justify-center rounded-[3px] border transition-colors duration-hover",
                    selected
                      ? "border-ice bg-ice text-bg-0"
                      : "border-line bg-bg-0"
                  )}
                >
                  {selected ? (
                    <svg viewBox="0 0 12 12" className="size-2.5" fill="none">
                      <path
                        d="M2.5 6.5l2.5 2.5 4.5-5"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : null}
                </span>
              ) : null}

              <span className="min-w-0 flex-1 truncate text-xs font-medium text-text-hi">
                {track.title}
              </span>
              <span
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  momentumDotClass(track.momentum)
                )}
                title={track.momentum}
              />
              <span className="hidden shrink-0 truncate text-xs text-text-lo sm:inline sm:max-w-[7rem]">
                {stageLabel}
              </span>
            </button>
          </div>
        ) : (
          <div
            className={cn(
              "well lift relative flex w-full items-center gap-3 p-4 text-left sm:gap-4",
              selecting && selected && "!border-ice/40 !bg-ice/5",
              overlay && "ring-1 ring-ice/60"
            )}
          >
            {showHandle ? (
              overlay ? (
                <span className="p-1 text-text-lo" aria-hidden>
                  <GripVertical className="size-4" />
                </span>
              ) : (
                <button
                  type="button"
                  className="cursor-grab touch-none p-1 text-text-lo active:cursor-grabbing"
                  aria-label={`Reorder ${track.title}`}
                  {...dragHandle?.attributes}
                  {...dragHandle?.listeners}
                >
                  <GripVertical className="size-4" />
                </button>
              )
            ) : null}

            <div className="group relative size-14 shrink-0 overflow-hidden rounded-input border border-line shadow-e1">
              <SpectraCoverArt
                trackId={track.id}
                title={track.title}
                artworkUrl={track.artwork_url}
                animate={false}
              />
              {playable && !selecting ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPlay();
                  }}
                  aria-label={isPlaying ? `Pause ${track.title}` : `Play ${track.title}`}
                  className="absolute inset-0 flex items-center justify-center bg-bg-0/0 opacity-0 transition-opacity duration-hover group-hover:bg-bg-0/55 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none"
                >
                  <span className="flex size-7 items-center justify-center rounded-full bg-ice text-bg-0 shadow-e1">
                    {isPlaying ? (
                      <Pause className="size-3.5" fill="currentColor" />
                    ) : (
                      <Play className="size-3.5 translate-x-px" fill="currentColor" />
                    )}
                  </span>
                </button>
              ) : null}
            </div>

            <button
              type="button"
              aria-pressed={selecting ? selected : undefined}
              onClick={() => (selecting ? onToggleSelect() : onOpen())}
              className="flex min-w-0 flex-1 items-center gap-4 text-left"
            >
              {selecting ? (
                <span
                  aria-hidden
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors duration-hover",
                    selected
                      ? "border-ice bg-ice text-bg-0"
                      : "border-line bg-bg-0"
                  )}
                >
                  {selected ? (
                    <svg viewBox="0 0 12 12" className="size-3" fill="none">
                      <path
                        d="M2.5 6.5l2.5 2.5 4.5-5"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : null}
                </span>
              ) : null}

              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-text-hi">
                    {track.title}
                  </span>
                  <span
                    className={cn(
                      "size-2 shrink-0 rounded-full",
                      momentumDotClass(track.momentum)
                    )}
                    title={track.momentum}
                  />
                </span>
                <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span
                    className={cn(
                      "rounded-chip px-2 py-0.5 text-xs",
                      typeChipClass(track.type)
                    )}
                  >
                    {formatTrackType(track.type)}
                  </span>
                  {meta.length > 0 ? (
                    <span className="font-mono text-xs text-text-lo">
                      {meta.join(" · ")}
                    </span>
                  ) : null}
                </span>
                <span className="mt-1.5 block truncate text-xs">
                  {blocked ? (
                    <span className="text-warn">
                      Blocked — {track.blocked_reason}
                    </span>
                  ) : track.next_action?.trim() ? (
                    <span className="text-text-lo">
                      <span className="text-text-lo/60">Next: </span>
                      {track.next_action}
                      {track.next_action_due ? (
                        <span className="font-mono text-text-lo/60">
                          {" · "}
                          {track.next_action_due}
                        </span>
                      ) : null}
                    </span>
                  ) : (
                    <span className="text-text-lo/50">No next move set</span>
                  )}
                </span>
              </span>

              <span className="hidden shrink-0 text-right sm:block">
                <span className="label-mono">Stage</span>
                <span className="mt-1 block text-xs text-text-hi">
                  {stageLabel}
                </span>
              </span>
            </button>
          </div>
        )}
      </SpotlightCard>
    </div>
  );
}
