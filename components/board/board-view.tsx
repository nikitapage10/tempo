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
import { Plus, Settings2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useActiveSpace } from "@/components/active-space-provider";
import { KanbanColumn } from "@/components/board/kanban-column";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { TrackCard } from "@/components/tracks/track-card";
import { TrackFormModal } from "@/components/tracks/track-form-modal";
import { StageEditor } from "@/components/stages/stage-editor";
import { useStages } from "@/hooks/use-stages";
import { useTrackMutations, useTracks } from "@/hooks/use-tracks";
import { TRACK_TYPES } from "@/lib/constants";
import type { Track, TrackInsert, TrackType } from "@/lib/types";

export function BoardView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeSpace, activeSpaceId, isLoading: spacesLoading } =
    useActiveSpace();
  const stagesQuery = useStages(activeSpaceId);
  const tracksQuery = useTracks(activeSpaceId);
  const { create, update, remove, moveStage } = useTrackMutations(activeSpaceId);

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
  const [trackModalOpen, setTrackModalOpen] = React.useState(false);
  const [editingTrack, setEditingTrack] = React.useState<Track | null>(null);
  const [stageEditorOpen, setStageEditorOpen] = React.useState(false);

  React.useEffect(() => {
    if (searchParams.get("new") === "1") {
      setEditingTrack(null);
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
      return true;
    });
  }, [tracks, typeFilter, tagFilter]);

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
    moveStage.mutate({ id: trackId, stageId: targetStageId });
  }

  async function handleCreateOrUpdate(values: TrackInsert & { id?: string }) {
    if (values.id) {
      const { id, space_id: _s, ...patch } = values;
      await update.mutateAsync({ id, patch });
    } else {
      await create.mutateAsync(values);
    }
  }

  const loading =
    spacesLoading || stagesQuery.isLoading || tracksQuery.isLoading;
  const emptyBoard = !loading && tracks.length === 0;

  return (
    <div className="flex h-full flex-col">
      <header className="mb-5 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-xl font-semibold tracking-tight text-text-hi">
              {activeSpace?.name ?? "Board"}
            </h1>
            <p className="mt-1 text-sm text-text-lo">
              Drag tracks across stages. Tap a card to edit.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
                setEditingTrack(null);
                setTrackModalOpen(true);
              }}
              disabled={!activeSpaceId || stages.length === 0}
            >
              <Plus className="size-3.5" />
              Track
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 font-mono text-[11px] uppercase tracking-[0.08em] text-text-lo">
              Type
            </span>
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
          </div>
          {allTags.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 font-mono text-[11px] uppercase tracking-[0.08em] text-text-lo">
                Tag
              </span>
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
            </div>
          ) : null}
        </div>
      </header>

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
          onAdd={() => {
            setEditingTrack(null);
            setTrackModalOpen(true);
          }}
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
          <div className="flex gap-3 overflow-x-auto pb-4">
            {stages.map((stage) => (
              <KanbanColumn
                key={stage.id}
                stage={stage}
                tracks={tracksByStage.get(stage.id) ?? []}
                isOver={overStageId === stage.id}
                onEditTrack={(t) => {
                  setEditingTrack(t);
                  setTrackModalOpen(true);
                }}
              />
            ))}
          </div>
          <DragOverlay>
            {activeDrag ? (
              <TrackCard
                track={activeDrag}
                onEdit={() => {}}
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
            onOpenChange={(open) => {
              setTrackModalOpen(open);
              if (!open) setEditingTrack(null);
            }}
            spaceId={activeSpaceId}
            stages={stages}
            track={editingTrack}
            onSubmit={handleCreateOrUpdate}
            onDelete={
              editingTrack
                ? async () => {
                    await remove.mutateAsync(editingTrack.id);
                  }
                : undefined
            }
          />
          <StageEditor
            open={stageEditorOpen}
            onOpenChange={setStageEditorOpen}
            spaceId={activeSpaceId}
            spaceName={activeSpace?.name ?? "Space"}
          />
        </>
      ) : null}
    </div>
  );
}

function EmptyBoard({
  spaceName,
  onAdd,
}: {
  spaceName: string;
  onAdd: () => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-card border border-line bg-bg-1">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "linear-gradient(135deg, rgba(127,180,255,0.25) 0%, transparent 40%, rgba(255,181,107,0.2) 100%)",
        }}
        aria-hidden
      />
      <div className="relative mx-auto flex max-w-md flex-col items-center px-6 py-16 text-center">
        <div className="flare-line mb-6 w-24" />
        <h2 className="font-display text-lg font-semibold text-text-hi">
          Nothing on the board yet
        </h2>
        <p className="mt-2 text-sm text-text-lo">
          {spaceName} is ready. Drop in a first track and drag it through the
          stages as it grows.
        </p>
        <Button className="mt-6" onClick={onAdd}>
          <Plus className="size-3.5" />
          Start a track
        </Button>
      </div>
    </div>
  );
}
