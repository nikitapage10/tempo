"use client";

import * as React from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { LayoutGroup } from "framer-motion";
import {
  Columns3,
  LayoutGrid,
  Plus,
  Rows2,
  Rows3,
  Settings2,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useActiveSpace } from "@/components/active-space-provider";
import {
  BoardNoteCard,
  parseNoteDragId,
} from "@/components/board/board-note-card";
import { BoardOverview } from "@/components/board/board-overview";
import { BoardStageSlot } from "@/components/board/board-stage-slot";
import { KanbanColumn } from "@/components/board/kanban-column";
import { StageRail } from "@/components/board/stage-rail";
import type { StageAddAction } from "@/components/board/stage-add-menu";
import { EmptyShaderPanel } from "@/components/shader-empty";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { FilterGroup } from "@/components/ui/filter-row";
import { HeaderMenu } from "@/components/ui/header-menu";
import { Input } from "@/components/ui/input";
import { useLayoutOverflowUnlock } from "@/components/ui/layout-item";
import { PageHeader } from "@/components/ui/page-header";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { TrackCard } from "@/components/tracks/track-card";
import { TrackFormModal } from "@/components/tracks/track-form-modal";
import { StageEditor } from "@/components/stages/stage-editor";
import {
  useBoardNoteMutations,
  useBoardNotes,
} from "@/hooks/use-board-notes";
import { useStages } from "@/hooks/use-stages";
import { useStageTransitionController } from "@/hooks/use-stage-transition";
import { useTrackMutations, useTracks } from "@/hooks/use-tracks";
import {
  BOARD_FOCUS_COUNT,
  boardFocusGridTemplate,
  clampBoardFocusStart,
  focusStartForStage,
} from "@/lib/board/view";
import { TRACK_TYPES } from "@/lib/constants";
import { deriveAttentionSignals } from "@/lib/attention/signals";
import type { BoardNote, Track, TrackInsert, TrackType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { insertIdBefore, isNoOpInsert, ranksForIds } from "@/lib/dnd/insert";
import {
  parseDropSlotId,
  sameDropSlot,
  type DropSlot,
} from "@/lib/dnd/drop-slot";

type BoardSort = "custom" | "title" | "updated" | "deadline";

const BOARD_SORTS: { value: BoardSort; label: string }[] = [
  { value: "custom", label: "Custom" },
  { value: "title", label: "Title" },
  { value: "updated", label: "Updated" },
  { value: "deadline", label: "Deadline" },
];

const BOARD_SORT_KEY = "tempo.boardSort";
const BOARD_VIEW_KEY = "tempo.boardView";
type BoardViewMode = "focus" | "overview";

const boardCollision: CollisionDetection = (args) => {
  const pointer = pointerWithin(args);
  if (pointer.length > 0) return pointer;
  return closestCorners(args);
};

function readBoardSort(): BoardSort {
  if (typeof window === "undefined") return "custom";
  const raw = localStorage.getItem(BOARD_SORT_KEY);
  if (BOARD_SORTS.some((o) => o.value === raw)) return raw as BoardSort;
  return "custom";
}

function sortBoardTracks(tracks: Track[], mode: BoardSort): Track[] {
  const list = [...tracks];
  if (mode === "custom") {
    return list.sort(
      (a, b) => a.list_sort - b.list_sort || a.title.localeCompare(b.title)
    );
  }
  if (mode === "title") {
    return list.sort((a, b) => a.title.localeCompare(b.title));
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

function sortNotes(notes: BoardNote[]): BoardNote[] {
  return [...notes].sort(
    (a, b) => a.sort - b.sort || a.title.localeCompare(b.title)
  );
}

type ActiveDrag =
  | { kind: "track"; track: Track }
  | { kind: "note"; note: BoardNote };

export function BoardView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeSpace, activeSpaceId, isLoading: spacesLoading } =
    useActiveSpace();
  const stagesQuery = useStages(activeSpaceId);
  const tracksQuery = useTracks(activeSpaceId);
  const notesQuery = useBoardNotes(activeSpaceId);
  const { create, moveStage, reorder } = useTrackMutations(activeSpaceId);
  const {
    create: createNote,
    update: updateNote,
    moveStage: moveNoteStage,
    remove: removeNote,
  } = useBoardNoteMutations(activeSpaceId);
  const { changeStage, dialog: stageTransitionDialog } =
    useStageTransitionController(activeSpaceId);
  const { toast } = useToast();

  const stages = React.useMemo(
    () => stagesQuery.data ?? [],
    [stagesQuery.data]
  );
  const tracks = React.useMemo(
    () => tracksQuery.data ?? [],
    [tracksQuery.data]
  );
  const notes = React.useMemo(
    () => notesQuery.data ?? [],
    [notesQuery.data]
  );

  const [typeFilter, setTypeFilter] = React.useState<TrackType | "all">("all");
  const [tagFilter, setTagFilter] = React.useState<string | "all">("all");
  const [attentionFilter, setAttentionFilter] = React.useState<
    "all" | "blocked" | "overdue" | "waiting"
  >("all");
  const [boardSort, setBoardSort] = React.useState<BoardSort>(readBoardSort);
  const [density, setDensity] = React.useState<"comfortable" | "compact">(() => {
    if (typeof window === "undefined") return "comfortable";
    return (
      (localStorage.getItem("tempo.boardDensity") as
        | "comfortable"
      | "compact") || "comfortable"
    );
  });
  const [viewMode, setViewMode] = React.useState<BoardViewMode>(() => {
    if (typeof window === "undefined") return "focus";
    return localStorage.getItem(BOARD_VIEW_KEY) === "overview"
      ? "overview"
      : "focus";
  });
  const [focusStart, setFocusStart] = React.useState(0);
  const [trackModalOpen, setTrackModalOpen] = React.useState(false);
  const [trackModalStageId, setTrackModalStageId] = React.useState<
    string | null
  >(null);
  const [stageEditorOpen, setStageEditorOpen] = React.useState(false);
  const [pickStageId, setPickStageId] = React.useState<string | null>(null);
  const [noteStageId, setNoteStageId] = React.useState<string | null>(null);
  const [noteTitle, setNoteTitle] = React.useState("");
  const [noteBody, setNoteBody] = React.useState("");
  const [noteSaving, setNoteSaving] = React.useState(false);

  React.useEffect(() => {
    if (searchParams.get("new") === "1") {
      setTrackModalStageId(null);
      setTrackModalOpen(true);
      router.replace("/board", { scroll: false });
    }
  }, [searchParams, router]);
  const [activeDrag, setActiveDrag] = React.useState<ActiveDrag | null>(null);
  const [overStageId, setOverStageId] = React.useState<string | null>(null);
  const [overSlot, setOverSlot] = React.useState<DropSlot | null>(null);
  const allowOverflow = useLayoutOverflowUnlock(!!activeDrag);

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
      if (attentionFilter !== "all") {
        const signals = deriveAttentionSignals({ track: t });
        const ids = new Set(signals.map((s) => s.id));
        if (attentionFilter === "blocked" && !ids.has("blocked")) return false;
        if (attentionFilter === "waiting" && !ids.has("waiting")) return false;
        if (
          attentionFilter === "overdue" &&
          !ids.has("next-overdue") &&
          !ids.has("deadline-approaching")
        )
          return false;
      }
      return true;
    });
  }, [tracks, typeFilter, tagFilter, attentionFilter]);

  const tracksByStage = React.useMemo(() => {
    const map = new Map<string, Track[]>();
    for (const s of stages) map.set(s.id, []);
    for (const t of filtered) {
      if (t.stage_id && map.has(t.stage_id)) {
        map.get(t.stage_id)!.push(t);
      }
    }
    for (const [stageId, list] of Array.from(map.entries())) {
      map.set(stageId, sortBoardTracks(list, boardSort));
    }
    return map;
  }, [stages, filtered, boardSort]);

  const notesByStage = React.useMemo(() => {
    const map = new Map<string, BoardNote[]>();
    for (const s of stages) map.set(s.id, []);
    for (const n of notes) {
      if (map.has(n.stage_id)) map.get(n.stage_id)!.push(n);
    }
    for (const [stageId, list] of Array.from(map.entries())) {
      map.set(stageId, sortNotes(list));
    }
    return map;
  }, [stages, notes]);

  React.useEffect(() => {
    setFocusStart((current) => clampBoardFocusStart(stages.length, current));
  }, [stages.length]);

  function setBoardView(mode: BoardViewMode) {
    setViewMode(mode);
    localStorage.setItem(BOARD_VIEW_KEY, mode);
  }

  function focusStage(index: number) {
    setFocusStart((current) =>
      focusStartForStage(stages.length, current, index)
    );
    setBoardView("focus");
  }

  /** Tracks with no stage — only shown in the Existing track… picker. */
  const unstagedTracks = React.useMemo(() => {
    const stageIds = new Set(stages.map((s) => s.id));
    return sortBoardTracks(
      tracks.filter((t) => !t.stage_id || !stageIds.has(t.stage_id)),
      "title"
    );
  }, [tracks, stages]);

  function setSort(mode: BoardSort) {
    setBoardSort(mode);
    localStorage.setItem(BOARD_SORT_KEY, mode);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  function resolveOverStage(overId: string): string | null {
    const slot = parseDropSlotId(overId);
    if (slot) return slot.containerId;
    if (stages.some((s) => s.id === overId)) return overId;
    const noteId = parseNoteDragId(overId);
    if (noteId) {
      return notes.find((n) => n.id === noteId)?.stage_id ?? null;
    }
    const overTrack = tracks.find((t) => t.id === overId);
    return overTrack?.stage_id ?? null;
  }

  function resolveDropSlot(
    overId: string,
    dragKind: ActiveDrag["kind"] | null
  ): DropSlot | null {
    const slot = parseDropSlotId(overId);
    if (slot) return slot;
    if (dragKind && stages.some((s) => s.id === overId)) {
      return { kind: dragKind, containerId: overId, beforeId: null };
    }
    const noteId = parseNoteDragId(overId);
    if (noteId && dragKind === "note") {
      const note = notes.find((n) => n.id === noteId);
      return note
        ? { kind: "note", containerId: note.stage_id, beforeId: note.id }
        : null;
    }
    const overTrack = tracks.find((t) => t.id === overId);
    if (overTrack && dragKind === "track") {
      return {
        kind: "track",
        containerId: overTrack.stage_id ?? overId,
        beforeId: overTrack.id,
      };
    }
    return null;
  }

  function noteIdsInStage(stageId: string, excludeId?: string) {
    return sortNotes(
      notes.filter((n) => n.stage_id === stageId && n.id !== excludeId)
    ).map((n) => n.id);
  }

  function trackIdsInStage(stageId: string, excludeId?: string) {
    return sortBoardTracks(
      tracks.filter((t) => t.stage_id === stageId && t.id !== excludeId),
      boardSort
    ).map((t) => t.id);
  }

  function clearDragState() {
    setActiveDrag(null);
    setOverStageId(null);
    setOverSlot(null);
  }

  function handleDragStart(event: DragStartEvent) {
    const id = String(event.active.id);
    const noteId = parseNoteDragId(id);
    if (noteId) {
      const note = notes.find((n) => n.id === noteId);
      setActiveDrag(note ? { kind: "note", note } : null);
      return;
    }
    const track = tracks.find((t) => t.id === id);
    setActiveDrag(track ? { kind: "track", track } : null);
  }

  function handleDragOver(event: DragOverEvent) {
    const overId = event.over?.id;
    if (!overId) {
      setOverStageId(null);
      setOverSlot(null);
      return;
    }
    const id = String(overId);
    setOverStageId(resolveOverStage(id));
    const dragKind = activeDrag?.kind ?? null;
    const slot = resolveDropSlot(id, dragKind);
    const activeEntityId =
      parseNoteDragId(String(event.active.id)) ?? String(event.active.id);
    if (slot && slot.beforeId !== activeEntityId) {
      setOverSlot((prev) => (sameDropSlot(prev, slot) ? prev : slot));
    } else {
      setOverSlot(null);
    }
  }

  async function persistNotePlacement(
    noteId: string,
    stageId: string,
    beforeId: string | null
  ) {
    const note = notes.find((n) => n.id === noteId);
    if (!note) return;
    const sameStage = note.stage_id === stageId;
    const originalIds = sameStage
      ? sortNotes(notes.filter((n) => n.stage_id === stageId)).map((n) => n.id)
      : [];
    const targetIds = noteIdsInStage(stageId, noteId);
    const nextIds = insertIdBefore(targetIds, noteId, beforeId);
    if (sameStage && isNoOpInsert(originalIds, noteId, beforeId)) return;

    const ranks = ranksForIds(nextIds);
    try {
      await Promise.all(
        ranks.map(({ id, sort }) =>
          updateNote.mutateAsync({
            id,
            patch: {
              sort,
              ...(id === noteId && !sameStage ? { stage_id: stageId } : {}),
            },
          })
        )
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn’t move that note.");
    }
  }

  async function persistTrackPlacement(
    trackId: string,
    stageId: string,
    beforeId: string | null
  ) {
    const track = tracks.find((t) => t.id === trackId);
    if (!track) return;
    const sameStage = track.stage_id === stageId;
    const originalIds = sameStage
      ? sortBoardTracks(
          tracks.filter((t) => t.stage_id === stageId),
          boardSort
        ).map((t) => t.id)
      : [];
    const targetIds = trackIdsInStage(stageId, trackId);
    const nextIds = insertIdBefore(targetIds, trackId, beforeId);
    if (sameStage && isNoOpInsert(originalIds, trackId, beforeId)) return;

    if (boardSort !== "custom") {
      setSort("custom");
    }

    try {
      if (!sameStage) {
        await changeStage(trackId, stageId, {
          trackTitle: track.title,
          fromStageId: track.stage_id,
        });
      }
      await reorder.mutateAsync(
        ranksForIds(nextIds).map(({ id, sort }) => ({
          id,
          list_sort: sort,
        }))
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn’t move that track.");
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const drag = activeDrag;
    const slot = overSlot;
    clearDragState();
    const { over } = event;
    if (!over || !drag) return;

    const resolved =
      slot ?? resolveDropSlot(String(over.id), drag.kind);
    if (!resolved) return;
    if (resolved.kind === "note" && drag.kind !== "note") return;
    if (resolved.kind === "track" && drag.kind !== "track") return;

    if (drag.kind === "note") {
      void persistNotePlacement(
        drag.note.id,
        resolved.containerId,
        resolved.beforeId
      );
      return;
    }

    void persistTrackPlacement(
      drag.track.id,
      resolved.containerId,
      resolved.beforeId
    );
  }

  async function removeFromBoard(track: Track) {
    try {
      await moveStage.mutateAsync({ id: track.id, stageId: null });
      toast(
        `“${track.title}” removed from the stage — still in Tracks.`,
        "ok"
      );
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Couldn’t remove that from the stage."
      );
    }
  }

  function handleStageAdd(stageId: string, action: StageAddAction) {
    if (action === "existing") {
      setPickStageId(stageId);
      return;
    }
    if (action === "new") {
      setTrackModalStageId(stageId);
      setTrackModalOpen(true);
      return;
    }
    setNoteTitle("");
    setNoteBody("");
    setNoteStageId(stageId);
  }

  async function handlePickExisting(track: Track) {
    if (!pickStageId) return;
    const stageId = pickStageId;
    setPickStageId(null);
    try {
      await changeStage(track.id, stageId, {
        trackTitle: track.title,
        fromStageId: track.stage_id,
      });
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Couldn’t add that to the stage."
      );
    }
  }

  async function handleCreateNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteStageId || !activeSpaceId) return;
    const title = noteTitle.trim();
    if (!title) {
      toast("Give the note a title.");
      return;
    }
    setNoteSaving(true);
    try {
      await createNote.mutateAsync({
        stage_id: noteStageId,
        title,
        body: noteBody.trim() || null,
      });
      setNoteStageId(null);
      toast("Note added.", "ok");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn’t add that note.");
    } finally {
      setNoteSaving(false);
    }
  }

  async function handleCreate(values: TrackInsert & { id?: string }) {
    await create.mutateAsync(values);
  }

  const filtersActive =
    typeFilter !== "all" || tagFilter !== "all" || attentionFilter !== "all";

  const onBoardCount = React.useMemo(() => {
    let n = 0;
    for (const t of filtered) {
      if (t.stage_id && stages.some((s) => s.id === t.stage_id)) n += 1;
    }
    return n + notes.length;
  }, [filtered, stages, notes.length]);

  // With only a couple of tracks on the board, small cards leave the columns
  // looking hollow. Give them more presence instead of stretching empty space.
  const roomy =
    density === "comfortable" &&
    filtered.length > 0 &&
    filtered.length <= 4;

  const loading =
    spacesLoading ||
    stagesQuery.isLoading ||
    tracksQuery.isLoading ||
    notesQuery.isLoading;
  const showColumns = !loading && stages.length > 0;

  const pickStageName =
    stages.find((s) => s.id === pickStageId)?.name ?? "this stage";
  const noteStageName =
    stages.find((s) => s.id === noteStageId)?.name ?? "this stage";

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={activeSpace?.name ?? "Board"}
        subtitle="Drag tracks and notes across stages. Remove clears the stage without deleting the track."
        actions={
          <>
            <HeaderMenu
              label="Sort"
              active={boardSort !== "custom"}
              summary={
                boardSort !== "custom"
                  ? BOARD_SORTS.find((o) => o.value === boardSort)?.label
                  : null
              }
            >
              <FilterGroup label="Order in columns" stacked>
                {BOARD_SORTS.map((opt) => (
                  <Chip
                    key={opt.value}
                    size="sm"
                    active={boardSort === opt.value}
                    onClick={() => setSort(opt.value)}
                  >
                    {opt.label}
                  </Chip>
                ))}
              </FilterGroup>
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
                        tagFilter !== "all",
                        attentionFilter !== "all",
                      ].filter(Boolean).length
                    )
                  : null
              }
              onClear={() => {
                setTypeFilter("all");
                setTagFilter("all");
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
              aria-label="Board view"
              className="flex items-center gap-0.5 rounded-input border border-line bg-bg-2/60 p-0.5"
            >
              <button
                type="button"
                aria-pressed={viewMode === "focus"}
                title="Three detailed stages"
                onClick={() => setBoardView("focus")}
                className={cn(
                  "flex items-center gap-1.5 rounded-[6px] px-2 py-1.5 text-xs transition-colors duration-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice",
                  viewMode === "focus"
                    ? "bg-bg-1 text-ice shadow-e1"
                    : "text-text-lo hover:text-text-hi"
                )}
              >
                <Columns3 className="size-3.5" />
                Focus
              </button>
              <button
                type="button"
                aria-pressed={viewMode === "overview"}
                title="See every stage at once"
                onClick={() => setBoardView("overview")}
                className={cn(
                  "flex items-center gap-1.5 rounded-[6px] px-2 py-1.5 text-xs transition-colors duration-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice",
                  viewMode === "overview"
                    ? "bg-bg-1 text-ice shadow-e1"
                    : "text-text-lo hover:text-text-hi"
                )}
              >
                <LayoutGrid className="size-3.5" />
                See all
              </button>
            </div>

            {viewMode === "focus" ? (
            <div
              role="group"
              aria-label="Card density"
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
                    localStorage.setItem("tempo.boardDensity", value);
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
            ) : null}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setStageEditorOpen(true)}
              disabled={!activeSpaceId}
            >
              <Settings2 className="size-3.5" />
              Stages
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setTrackModalStageId(null);
                setTrackModalOpen(true);
              }}
              disabled={!activeSpaceId || stages.length === 0}
            >
              <Plus className="size-3.5" />
              Track
            </Button>
          </>
        }
      />

      {loading ? (
        <div className="flex gap-3 overflow-hidden">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-64 w-[280px] shrink-0 animate-pulse rounded-card border border-line bg-bg-1"
            />
          ))}
        </div>
      ) : !showColumns ? (
        <EmptyBoard
          spaceName={activeSpace?.name ?? "this space"}
          onAdd={() => {
            setTrackModalStageId(null);
            setTrackModalOpen(true);
          }}
        />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={boardCollision}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={clearDragState}
        >
          {viewMode === "overview" ? (
            <BoardOverview
              stages={stages}
              tracksByStage={tracksByStage}
              notesByStage={notesByStage}
              onFocusStage={focusStage}
            />
          ) : (
            <LayoutGroup id="tempo-board">
            <div
              className={cn(
                "flex flex-col gap-2 pb-3 lg:grid lg:items-stretch lg:transition-[grid-template-columns] lg:will-change-[grid-template-columns] motion-reduce:transition-none",
                allowOverflow ? "lg:overflow-visible" : "lg:overflow-hidden"
              )}
              style={{
                gridTemplateColumns: boardFocusGridTemplate(
                  stages.length,
                  focusStart
                ),
                transitionDuration: "620ms",
                transitionTimingFunction: "cubic-bezier(0.2, 0.75, 0.25, 1)",
              }}
              aria-label={`Board stages, ${Math.min(BOARD_FOCUS_COUNT, stages.length)} detailed at a time`}
            >
              {stages.map((stage, index) => {
                const inFocus =
                  index >= focusStart &&
                  index < focusStart + BOARD_FOCUS_COUNT;
                const stageTracks = tracksByStage.get(stage.id) ?? [];
                const stageNotes = notesByStage.get(stage.id) ?? [];
                return (
                  <BoardStageSlot
                    key={stage.id}
                    expanded={inFocus}
                    overflowVisible={allowOverflow}
                    railContent={
                      <StageRail
                        stage={stage}
                        stages={stages}
                        itemCount={stageTracks.length + stageNotes.length}
                        isOver={overStageId === stage.id}
                        onOpen={() => focusStage(index)}
                      />
                    }
                    expandedContent={
                      <KanbanColumn
                        stage={stage}
                        stages={stages}
                        tracks={stageTracks}
                        notes={stageNotes}
                        isOver={overStageId === stage.id}
                        onOpenTrack={(t) => router.push(`/track/${t.id}`)}
                        onRemoveFromBoard={(t) => void removeFromBoard(t)}
                        onStageAdd={(action) =>
                          handleStageAdd(stage.id, action)
                        }
                        onSaveNote={(note, patch) => {
                          void updateNote.mutateAsync({ id: note.id, patch }).catch((err) => {
                            toast(err instanceof Error ? err.message : "Couldn’t save that note.");
                          });
                        }}
                        onDeleteNote={(note) => {
                          void removeNote.mutateAsync(note.id).then(
                            () => toast("Note deleted.", "ok"),
                            (err) => toast(err instanceof Error ? err.message : "Couldn’t delete that note.")
                          );
                        }}
                        compact={density === "compact"}
                        roomy={roomy}
                        dragging={!!activeDrag}
                        draggingKind={activeDrag?.kind ?? null}
                        activeSlot={
                          overSlot?.kind === "track" || overSlot?.kind === "note"
                            ? (overSlot as Extract<
                                DropSlot,
                                { kind: "track" | "note" }
                              >)
                            : null
                        }
                        showInsertSlots={!!activeDrag}
                        allowCollapse={onBoardCount > 0 || tracks.length > 0}
                        fillAvailable
                        allowOverflow={allowOverflow}
                      />
                    }
                  />
                );
              })}
            </div>
            </LayoutGroup>
          )}
          <DragOverlay dropAnimation={null}>
            {activeDrag?.kind === "track" ? (
              <TrackCard
                track={activeDrag.track}
                onOpen={() => {}}
                compact={density === "compact"}
                roomy={roomy}
                isDragOverlay
              />
            ) : null}
            {activeDrag?.kind === "note" ? (
              <BoardNoteCard
                note={activeDrag.note}
                compact={density === "compact"}
                isDragOverlay
                onSave={() => {}}
                onDelete={() => {}}
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {activeSpaceId ? (
        <>
          <TrackFormModal
            open={trackModalOpen}
            onOpenChange={(open) => {
              setTrackModalOpen(open);
              if (!open) setTrackModalStageId(null);
            }}
            spaceId={activeSpaceId}
            stages={stages}
            defaultStageId={trackModalStageId}
            onSubmit={handleCreate}
          />
          <StageEditor
            open={stageEditorOpen}
            onOpenChange={setStageEditorOpen}
            spaceId={activeSpaceId}
            spaceName={activeSpace?.name ?? "Space"}
          />
        </>
      ) : null}

      <Dialog
        open={!!pickStageId}
        onOpenChange={(open) => {
          if (!open) setPickStageId(null);
        }}
      >
        <DialogContent
          title={`Add to ${pickStageName}`}
          description="Pick a track that doesn’t have a stage yet."
          onClose={() => setPickStageId(null)}
        >
          {unstagedTracks.length === 0 ? (
            <p className="text-sm text-text-lo">
              No tracks without a stage — start a new track.
            </p>
          ) : (
            <ul className="mt-1 max-h-64 space-y-1 overflow-y-auto">
              {unstagedTracks.map((track) => (
                <li key={track.id}>
                  <button
                    type="button"
                    className="well w-full truncate px-3 py-2 text-left text-sm text-text-hi hover:border-ice/40 hover:text-ice"
                    onClick={() => void handlePickExisting(track)}
                  >
                    {track.title}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setPickStageId(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!pickStageId) return;
                const stageId = pickStageId;
                setPickStageId(null);
                setTrackModalStageId(stageId);
                setTrackModalOpen(true);
              }}
            >
              <Plus className="size-3.5" />
              New track
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!noteStageId}
        onOpenChange={(open) => {
          if (!open) setNoteStageId(null);
        }}
      >
        <DialogContent
          title={`Note in ${noteStageName}`}
          description="A sticky reminder on the board — not a track."
          onClose={() => setNoteStageId(null)}
        >
          <form onSubmit={(e) => void handleCreateNote(e)} className="mt-2 space-y-3">
            <label className="block">
              <span className="label-mono">Title</span>
              <Input
                className="mt-1.5"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                placeholder="e.g. Need stems from Alex"
                autoFocus
              />
            </label>
            <label className="block">
              <span className="label-mono">Details (optional)</span>
              <Textarea
                className="mt-1.5"
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                rows={3}
                placeholder="Anything you want to remember here…"
              />
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                disabled={noteSaving}
                onClick={() => setNoteStageId(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={noteSaving || !noteTitle.trim()}>
                {noteSaving ? "Adding…" : "Add note"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {stageTransitionDialog}
    </div>
  );
}

function EmptyBoard({
  onAdd,
}: {
  spaceName: string;
  onAdd: () => void;
}) {
  return (
    <EmptyShaderPanel
      title="Board is empty"
      copy="Start a track and drag it through the stages — or add a note from a stage’s +."
      action={
        <Button onClick={onAdd}>
          <Plus className="size-3.5" />
          Start a track
        </Button>
      }
    />
  );
}
