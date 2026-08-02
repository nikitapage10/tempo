"use client";

import * as React from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FolderPlus, GripVertical, Pause, Play, Plus, Rows2, Rows3, Trash2, X } from "lucide-react";
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
import { useTrackMutations, useTracks } from "@/hooks/use-tracks";
import { useVersionsForTracks } from "@/hooks/use-versions";
import { deriveAttentionSignals } from "@/lib/attention/signals";
import { TRACK_TYPES } from "@/lib/constants";
import {
  formatTrackType,
  momentumDotClass,
  typeChipClass,
} from "@/lib/track-style";
import type { Track, TrackGroup, TrackInsert, TrackListPreset, TrackType } from "@/lib/types";
import { cn } from "@/lib/utils";

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
  tracks: Track[];
};

function buildTrackSections(
  tracks: Track[],
  groups: TrackGroup[]
): TrackSection[] {
  if (groups.length === 0) {
    return [{ groupId: null, name: "", tracks }];
  }

  const byGroup = new Map<GroupKey, Track[]>();
  for (const g of groups) byGroup.set(g.id, []);
  byGroup.set(null, []);

  for (const t of tracks) {
    byGroup.get(trackGroupKey(t, groups))!.push(t);
  }

  const sections: TrackSection[] = groups.map((g) => ({
    groupId: g.id,
    name: g.name,
    tracks: byGroup.get(g.id)!,
  }));
  // No heading: these tracks aren't in a container, so labelling them invents
  // one. They simply sit under the named groups.
  sections.push({
    groupId: null,
    name: "",
    tracks: byGroup.get(null)!,
  });
  return sections;
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
  const { create, remove, reorder } = useTrackMutations(activeSpaceId);
  const {
    create: createPreset,
    update: updatePreset,
    remove: removePreset,
  } = useTrackListPresetMutations(activeSpaceId);
  const {
    create: createGroup,
    update: updateGroup,
    reorder: reorderGroups,
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

  const [saveOpen, setSaveOpen] = React.useState(false);
  const [saveName, setSaveName] = React.useState("");
  const [savingOrder, setSavingOrder] = React.useState(false);

  const [groupDialog, setGroupDialog] = React.useState<
    null | { mode: "create" } | { mode: "rename"; group: TrackGroup }
  >(null);
  const [groupName, setGroupName] = React.useState("");
  const [savingGroup, setSavingGroup] = React.useState(false);
  const [deleteGroupTarget, setDeleteGroupTarget] =
    React.useState<TrackGroup | null>(null);
  const [overGroupId, setOverGroupId] = React.useState<GroupKey | undefined>(
    undefined
  );

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

  const sections = React.useMemo(
    () => buildTrackSections(displayed, groups),
    [displayed, groups]
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
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
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
    const target = resolveDropGroup(String(overId), tracks, groups);
    // A group can only land on another group — highlighting the ungrouped run
    // would suggest a drop that does nothing.
    if (parseGroupSortId(String(event.active.id)) && target === null) {
      setOverGroupId(undefined);
      return;
    }
    setOverGroupId(target);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setOverGroupId(undefined);
    if (!over || active.id === over.id || !canDrag) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    // A whole group was dragged by its handle: reorder the groups themselves
    // rather than anything inside them.
    const draggedGroupId = parseGroupSortId(activeId);
    if (draggedGroupId) {
      const overGroup = resolveDropGroup(overId, tracks, groups);
      // Dropped on the ungrouped run, or on nothing recognisable.
      if (!overGroup || overGroup === draggedGroupId) return;
      const from = groups.findIndex((g) => g.id === draggedGroupId);
      const to = groups.findIndex((g) => g.id === overGroup);
      if (from < 0 || to < 0 || from === to) return;
      const next = arrayMove(groups, from, to);
      reorderGroups.mutate(next.map((g, sort) => ({ id: g.id, sort })));
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
    setGroupDialog({ mode: "create" });
  }

  function openRenameGroup(group: TrackGroup) {
    setGroupName(group.name);
    setGroupDialog({ mode: "rename", group });
  }

  async function handleSaveGroup() {
    const name = groupName.trim();
    if (!name || !groupDialog) return;
    setSavingGroup(true);
    try {
      if (groupDialog.mode === "create") {
        const group = await createGroup.mutateAsync(name);
        toast(`Created “${group.name}”. Drag tracks into it.`, "ok");
      } else {
        await updateGroup.mutateAsync({
          id: groupDialog.group.id,
          name,
        });
        toast(`Renamed to “${name}”.`, "ok");
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

  function moveGroup(groupId: string, direction: -1 | 1) {
    const index = groups.findIndex((g) => g.id === groupId);
    const swapWith = index + direction;
    if (index < 0 || swapWith < 0 || swapWith >= groups.length) return;
    const next = arrayMove(groups, index, swapWith);
    reorderGroups.mutate(next.map((g, sort) => ({ id: g.id, sort })));
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
              <Button
                size="sm"
                variant="destructive"
                disabled={selected.size === 0}
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="size-3.5" />
                Delete
              </Button>
              <Button size="sm" variant="ghost" onClick={exitSelecting}>
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
                              "inline-flex items-center gap-0.5 rounded-chip border text-[11px]",
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
                      className="self-start text-[11px] text-ice hover:underline"
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
        <div className="rounded-card border border-dashed border-line/70 px-4 py-10 text-center">
          <p className="text-sm text-text-lo">Nothing matches these filters.</p>
          <button
            type="button"
            onClick={() => {
              setTypeFilter("all");
              setTagFilter("all");
              setStageFilter("all");
              setAttentionFilter("all");
            }}
            className="mt-2 text-[11px] text-ice hover:underline"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <>
          {sortSelection === "custom" && !selecting ? (
            <p className="mb-2 text-[11px] text-text-lo/70">
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
            <p className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-lo/70">
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
            <p className="mb-2 text-[11px] text-text-lo/70">
              Sorted by{" "}
              {BUILTIN_SORTS.find((o) => o.value === sortSelection)?.label}
            </p>
          ) : null}

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setOverGroupId(undefined)}
          >
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
                    const groupIndex =
                      section.groupId === null
                        ? -1
                        : groups.findIndex((g) => g.id === section.groupId);
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
                          group && groupIndex > 0
                            ? () => moveGroup(group.id, -1)
                            : undefined
                        }
                        onMoveDown={
                          group &&
                          groupIndex >= 0 &&
                          groupIndex < groups.length - 1
                            ? () => moveGroup(group.id, 1)
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
          </DndContext>
        </>
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
            groupDialog?.mode === "rename" ? "Rename group" : "New group"
          }
          description={
            groupDialog?.mode === "rename"
              ? "Just the label on the Tracks list — projects stay as they are."
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
          <div className="mt-4 flex justify-end gap-2">
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
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: track.id, disabled: !canDrag });

  const meta: string[] = [];
  if (track.bpm != null) meta.push(`${track.bpm} BPM`);
  if (track.musical_key) meta.push(track.musical_key);

  const blocked = !!track.blocked_reason?.trim();

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(isDragging && "relative z-10")}
    >
      <SpotlightCard
        tone={blocked ? "warn" : "ramp"}
        radius={compact ? 10 : 12}
        size={compact ? 160 : 240}
        className={cn(isDragging && "opacity-90 shadow-raise")}
      >
        {compact ? (
          <div
            className={cn(
              "well relative flex w-full items-center gap-2 px-2 py-1 text-left",
              selecting && selected && "!border-ice/40 !bg-ice/5"
            )}
          >
            {canDrag ? (
              <button
                type="button"
                className="cursor-grab touch-none p-0.5 text-text-lo active:cursor-grabbing"
                aria-label={`Reorder ${track.title}`}
                {...attributes}
                {...listeners}
              >
                <GripVertical className="size-3.5" />
              </button>
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
              <span className="hidden shrink-0 truncate text-[11px] text-text-lo sm:inline sm:max-w-[7rem]">
                {stageLabel}
              </span>
            </button>
          </div>
        ) : (
          <div
            className={cn(
              "well lift relative flex w-full items-center gap-3 p-4 text-left sm:gap-4",
              selecting && selected && "!border-ice/40 !bg-ice/5"
            )}
          >
            {canDrag ? (
              <button
                type="button"
                className="cursor-grab touch-none p-1 text-text-lo active:cursor-grabbing"
                aria-label={`Reorder ${track.title}`}
                {...attributes}
                {...listeners}
              >
                <GripVertical className="size-4" />
              </button>
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
                      "rounded-chip px-2 py-0.5 text-[11px]",
                      typeChipClass(track.type)
                    )}
                  >
                    {formatTrackType(track.type)}
                  </span>
                  {meta.length > 0 ? (
                    <span className="font-mono text-[11px] text-text-lo">
                      {meta.join(" · ")}
                    </span>
                  ) : null}
                </span>
                <span className="mt-1.5 block truncate text-[11px]">
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
    </li>
  );
}
