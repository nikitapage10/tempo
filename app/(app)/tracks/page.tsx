"use client";

import * as React from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Rows2, Rows3, Trash2, X } from "lucide-react";
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
import { useStages } from "@/hooks/use-stages";
import {
  useTrackListPresetMutations,
  useTrackListPresets,
} from "@/hooks/use-track-list-presets";
import { useTrackMutations, useTracks } from "@/hooks/use-tracks";
import { deriveAttentionSignals } from "@/lib/attention/signals";
import { TRACK_TYPES } from "@/lib/constants";
import {
  formatTrackType,
  momentumDotClass,
  typeChipClass,
} from "@/lib/track-style";
import type { Track, TrackInsert, TrackListPreset, TrackType } from "@/lib/types";
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

export default function TracksPage() {
  const router = useRouter();
  const { activeSpace, activeSpaceId, isLoading: spacesLoading } =
    useActiveSpace();
  const stagesQuery = useStages(activeSpaceId);
  const tracksQuery = useTracks(activeSpaceId);
  const presetsQuery = useTrackListPresets(activeSpaceId);
  const { create, remove, reorder } = useTrackMutations(activeSpaceId);
  const {
    create: createPreset,
    update: updatePreset,
    remove: removePreset,
  } = useTrackListPresetMutations(activeSpaceId);
  const { toast } = useToast();

  const stages = React.useMemo(
    () => stagesQuery.data ?? [],
    [stagesQuery.data]
  );
  const tracks = tracksQuery.data ?? [];
  const presets = presetsQuery.data ?? [];
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

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !canDrag) return;

    const visibleIds = displayed.map((t) => t.id);
    const oldIndex = visibleIds.indexOf(String(active.id));
    const newIndex = visibleIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;

    const nextVisible = arrayMove(visibleIds, oldIndex, newIndex);
    const allOrdered = customOrderedIds();
    const merged = mergeVisibleReorder(allOrdered, nextVisible);
    reorder.mutate(merged.map((id, list_sort) => ({ id, list_sort })));
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

  const loading = spacesLoading || tracksQuery.isLoading;
  const selectedTracks = tracks.filter((t) => selected.has(t.id));

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
              Drag to rearrange ·{" "}
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
              adds it to Sort
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
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={displayed.map((t) => t.id)}
              strategy={verticalListSortingStrategy}
              disabled={!canDrag}
            >
              <ul className={cn(density === "compact" ? "space-y-1" : "space-y-2")}>
                {displayed.map((track) => (
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
                  />
                ))}
              </ul>
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
}: {
  track: Track;
  stageLabel: string;
  selecting: boolean;
  selected: boolean;
  canDrag: boolean;
  compact?: boolean;
  onToggleSelect: () => void;
  onOpen: () => void;
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

              <span className="relative size-14 shrink-0 overflow-hidden rounded-input border border-line shadow-e1">
                <SpectraCoverArt
                  trackId={track.id}
                  title={track.title}
                  artworkUrl={track.artwork_url}
                  animate={false}
                />
              </span>

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
