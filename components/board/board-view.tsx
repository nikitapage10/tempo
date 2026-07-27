"use client";

import * as React from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Plus, Rows2, Rows3, Settings2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useActiveSpace } from "@/components/active-space-provider";
import { KanbanColumn } from "@/components/board/kanban-column";
import { EmptyShaderPanel } from "@/components/shader-empty";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { PageHeader } from "@/components/ui/page-header";
import { FilterRow } from "@/components/ui/filter-row";
import { TrackCard } from "@/components/tracks/track-card";
import { TrackFormModal } from "@/components/tracks/track-form-modal";
import { StageEditor } from "@/components/stages/stage-editor";
import { useStages } from "@/hooks/use-stages";
import { useStageTransitionController } from "@/hooks/use-stage-transition";
import { useTrackMutations, useTracks } from "@/hooks/use-tracks";
import { TRACK_TYPES } from "@/lib/constants";
import { deriveAttentionSignals } from "@/lib/attention/signals";
import type { Track, TrackInsert, TrackType } from "@/lib/types";
import { cn } from "@/lib/utils";

export function BoardView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeSpace, activeSpaceId, isLoading: spacesLoading } =
    useActiveSpace();
  const stagesQuery = useStages(activeSpaceId);
  const tracksQuery = useTracks(activeSpaceId);
  const { create } = useTrackMutations(activeSpaceId);
  const { changeStage, dialog: stageTransitionDialog } =
    useStageTransitionController(activeSpaceId);

  const stages = React.useMemo(
    () => stagesQuery.data ?? [],
    [stagesQuery.data]
  );
  const tracks = React.useMemo(
    () => tracksQuery.data ?? [],
    [tracksQuery.data]
  );

  const [typeFilter, setTypeFilter] = React.useState<TrackType | "all">("all");
  const [tagFilter, setTagFilter] = React.useState<string | "all">("all");
  const [attentionFilter, setAttentionFilter] = React.useState<
    "all" | "blocked" | "overdue" | "waiting"
  >("all");
  const [density, setDensity] = React.useState<"comfortable" | "compact">(() => {
    if (typeof window === "undefined") return "comfortable";
    return (localStorage.getItem("tempo.boardDensity") as "comfortable" | "compact") || "comfortable";
  });
  const [trackModalOpen, setTrackModalOpen] = React.useState(false);
  const [stageEditorOpen, setStageEditorOpen] = React.useState(false);

  React.useEffect(() => {
    if (searchParams.get("new") === "1") {
      setTrackModalOpen(true);
      router.replace("/board", { scroll: false });
    }
  }, [searchParams, router]);
  const [activeDrag, setActiveDrag] = React.useState<Track | null>(null);
  const [overStageId, setOverStageId] = React.useState<string | null>(null);

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
    return map;
  }, [stages, filtered]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  function handleDragStart(event: DragStartEvent) {
    const track = tracks.find((t) => t.id === event.active.id);
    setActiveDrag(track ?? null);
  }

  function handleDragOver(event: DragOverEvent) {
    const overId = event.over?.id;
    if (!overId) {
      setOverStageId(null);
      return;
    }
    if (stages.some((s) => s.id === overId)) {
      setOverStageId(String(overId));
      return;
    }
    const overTrack = tracks.find((t) => t.id === overId);
    setOverStageId(overTrack?.stage_id ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDrag(null);
    setOverStageId(null);
    const { active, over } = event;
    if (!over) return;

    const trackId = String(active.id);
    const track = tracks.find((t) => t.id === trackId);
    if (!track) return;

    let targetStageId: string | null = null;
    if (stages.some((s) => s.id === over.id)) {
      targetStageId = String(over.id);
    } else {
      const overTrack = tracks.find((t) => t.id === over.id);
      targetStageId = overTrack?.stage_id ?? null;
    }

    if (!targetStageId || targetStageId === track.stage_id) return;
    void changeStage(trackId, targetStageId, {
      trackTitle: track.title,
      fromStageId: track.stage_id,
    });
  }

  async function handleCreate(values: TrackInsert & { id?: string }) {
    await create.mutateAsync(values);
  }

  const filtersActive =
    typeFilter !== "all" || tagFilter !== "all" || attentionFilter !== "all";

  // With only a couple of tracks on the board, small cards leave the columns
  // looking hollow. Give them more presence instead of stretching empty space.
  const roomy = density === "comfortable" && filtered.length > 0 && filtered.length <= 4;

  const loading =
    spacesLoading || stagesQuery.isLoading || tracksQuery.isLoading;
  const emptyBoard = !loading && tracks.length === 0;

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={activeSpace?.name ?? "Board"}
        subtitle="Drag tracks across stages. Tap a card to open it."
        actions={
          <>
            {/* Density is a view control, so it sits with the other view
                actions rather than among the content filters. */}
            <div
              role="group"
              aria-label="Card density"
              className="flex items-center gap-0.5 rounded-input border border-line bg-bg-2/60 p-0.5"
            >
              {(
                [
                  ["comfortable", Rows3, "Comfortable"],
                  ["compact", Rows2, "Compact"],
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
              onClick={() => setTrackModalOpen(true)}
              disabled={!activeSpaceId || stages.length === 0}
            >
              <Plus className="size-3.5" />
              Track
            </Button>
          </>
        }
      >
        {/* One bordered filter bar with aligned label columns. Density used to
            live here too, but it's a view setting, not a content filter — it
            moved up to the header actions. */}
        <div className="panel-quiet overflow-hidden">
          <FilterRow label="Type">
            <Chip
              active={typeFilter === "all"}
              onClick={() => setTypeFilter("all")}
            >
              All
            </Chip>
            {TRACK_TYPES.map((t) => (
              <Chip
                key={t.value}
                active={typeFilter === t.value}
                onClick={() => setTypeFilter(t.value)}
              >
                {t.label}
              </Chip>
            ))}
          </FilterRow>

          {allTags.length > 0 ? (
            <FilterRow label="Tag" divider>
              <Chip
                active={tagFilter === "all"}
                onClick={() => setTagFilter("all")}
              >
                All
              </Chip>
              {allTags.map((tag) => (
                <Chip
                  key={tag}
                  active={tagFilter === tag}
                  onClick={() => setTagFilter(tag)}
                >
                  {tag}
                </Chip>
              ))}
            </FilterRow>
          ) : null}

          <FilterRow
            divider
            label="Show"
            trailing={
              filtersActive ? (
                <button
                  type="button"
                  onClick={() => {
                    setTypeFilter("all");
                    setTagFilter("all");
                    setAttentionFilter("all");
                  }}
                  className="whitespace-nowrap text-[11px] text-ice transition-colors duration-hover hover:underline"
                >
                  Clear filters
                </button>
              ) : null
            }
          >
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
                active={attentionFilter === value}
                onClick={() => setAttentionFilter(value)}
              >
                {label}
              </Chip>
            ))}
          </FilterRow>
        </div>
      </PageHeader>

      {loading ? (
        <div className="flex gap-3 overflow-hidden">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-64 w-[280px] shrink-0 animate-pulse rounded-card border border-line bg-bg-1"
            />
          ))}
        </div>
      ) : emptyBoard ? (
        <EmptyBoard
          spaceName={activeSpace?.name ?? "this space"}
          onAdd={() => setTrackModalOpen(true)}
        />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={() => {
            setActiveDrag(null);
            setOverStageId(null);
          }}
        >
          {/* Columns share the available width instead of scrolling off-screen.
              Empty stages collapse to slim rails so the pipeline stays visible
              at a glance; a drag expands everything so any stage is droppable. */}
          {/* Below lg the stages stack vertically — columns would be too narrow
              to read, and vertical scrolling beats horizontal on touch. */}
          <div className="flex flex-col gap-2 pb-4 lg:flex-row lg:items-stretch lg:overflow-x-auto">
            {stages.map((stage) => (
              <KanbanColumn
                key={stage.id}
                stage={stage}
                stages={stages}
                tracks={tracksByStage.get(stage.id) ?? []}
                isOver={overStageId === stage.id}
                onOpenTrack={(t) => router.push(`/track/${t.id}`)}
                compact={density === "compact"}
                roomy={roomy}
                dragging={!!activeDrag}
                allowCollapse={filtered.length > 0}
              />
            ))}
          </div>
          <DragOverlay>
            {activeDrag ? (
              <TrackCard
                track={activeDrag}
                onOpen={() => {}}
                roomy={roomy}
                isDragOverlay
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {activeSpaceId ? (
        <>
          <TrackFormModal
            open={trackModalOpen}
            onOpenChange={setTrackModalOpen}
            spaceId={activeSpaceId}
            stages={stages}
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
      copy="Start a track and drag it through the stages."
      action={
        <Button onClick={onAdd}>
          <Plus className="size-3.5" />
          Start a track
        </Button>
      }
    />
  );
}

