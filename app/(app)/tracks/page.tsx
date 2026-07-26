"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { useActiveSpace } from "@/components/active-space-provider";
import { Button } from "@/components/ui/button";
import { TrackFormModal } from "@/components/tracks/track-form-modal";
import { useStages } from "@/hooks/use-stages";
import { useTrackMutations, useTracks } from "@/hooks/use-tracks";
import {
  formatTrackType,
  gradientFromTrackId,
  momentumDotClass,
  typeChipClass,
} from "@/lib/track-style";
import type { Track, TrackInsert } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function TracksPage() {
  const { activeSpace, activeSpaceId, isLoading: spacesLoading } =
    useActiveSpace();
  const stagesQuery = useStages(activeSpaceId);
  const tracksQuery = useTracks(activeSpaceId);
  const { create, update, remove } = useTrackMutations(activeSpaceId);

  const stages = React.useMemo(
    () => stagesQuery.data ?? [],
    [stagesQuery.data]
  );
  const tracks = tracksQuery.data ?? [];
  const stageName = React.useMemo(() => {
    const map = new Map(stages.map((s) => [s.id, s.name]));
    return (id: string | null) => (id ? map.get(id) ?? "—" : "—");
  }, [stages]);

  const [modalOpen, setModalOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Track | null>(null);

  async function handleSubmit(values: TrackInsert & { id?: string }) {
    if (values.id) {
      const { id, space_id: _s, ...patch } = values;
      await update.mutateAsync({ id, patch });
    } else {
      await create.mutateAsync(values);
    }
  }

  const loading = spacesLoading || tracksQuery.isLoading;

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold tracking-tight text-text-hi">
            Tracks
          </h1>
          <p className="mt-1 text-sm text-text-lo">
            Everything in {activeSpace?.name ?? "this space"}.
          </p>
        </div>
        <Button
          size="sm"
          disabled={!activeSpaceId || stages.length === 0}
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
        >
          <Plus className="size-3.5" />
          Track
        </Button>
      </header>

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
        <div className="rounded-card border border-line bg-bg-1 px-6 py-12 text-center">
          <p className="text-sm text-text-lo">
            No tracks yet. Start one and park it on the board.
          </p>
          <Button
            className="mt-4"
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
          >
            <Plus className="size-3.5" />
            Start a track
          </Button>
        </div>
      ) : (
        <ul className="space-y-2">
          {tracks.map((track) => {
            const meta: string[] = [];
            if (track.bpm != null) meta.push(`${track.bpm} BPM`);
            if (track.musical_key) meta.push(track.musical_key);
            return (
              <li key={track.id}>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(track);
                    setModalOpen(true);
                  }}
                  className="flex w-full items-center gap-3 rounded-card border border-line bg-bg-1 p-3 text-left transition-colors duration-hover hover:border-ice/30"
                >
                  <span
                    className="size-10 shrink-0 overflow-hidden rounded-input border border-line"
                    style={
                      track.artwork_url
                        ? undefined
                        : { background: gradientFromTrackId(track.id) }
                    }
                  >
                    {track.artwork_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={track.artwork_url}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : null}
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
                      />
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span
                        className={cn(
                          "rounded-chip px-2 py-0.5 text-[11px]",
                          typeChipClass(track.type)
                        )}
                      >
                        {formatTrackType(track.type)}
                      </span>
                      <span className="text-[11px] text-text-lo">
                        {stageName(track.stage_id)}
                      </span>
                      {meta.length > 0 ? (
                        <span className="font-mono text-[11px] text-text-lo">
                          {meta.join(" · ")}
                        </span>
                      ) : null}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {activeSpaceId ? (
        <TrackFormModal
          open={modalOpen}
          onOpenChange={(open) => {
            setModalOpen(open);
            if (!open) setEditing(null);
          }}
          spaceId={activeSpaceId}
          stages={stages}
          track={editing}
          onSubmit={handleSubmit}
          onDelete={
            editing
              ? async () => {
                  await remove.mutateAsync(editing.id);
                }
              : undefined
          }
        />
      ) : null}
    </div>
  );
}
