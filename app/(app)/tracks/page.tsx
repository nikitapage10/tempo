"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActiveSpace } from "@/components/active-space-provider";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { SignedImage } from "@/components/ui/signed-image";
import { EmptyShaderPanel } from "@/components/shader-empty";
import { TrackFormModal } from "@/components/tracks/track-form-modal";
import { useStages } from "@/hooks/use-stages";
import { useTrackMutations, useTracks } from "@/hooks/use-tracks";
import {
  formatTrackType,
  gradientFromTrackId,
  momentumDotClass,
  typeChipClass,
} from "@/lib/track-style";
import type { TrackInsert } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function TracksPage() {
  const router = useRouter();
  const { activeSpace, activeSpaceId, isLoading: spacesLoading } =
    useActiveSpace();
  const stagesQuery = useStages(activeSpaceId);
  const tracksQuery = useTracks(activeSpaceId);
  const { create } = useTrackMutations(activeSpaceId);

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

  async function handleSubmit(values: TrackInsert & { id?: string }) {
    await create.mutateAsync(values);
  }

  const loading = spacesLoading || tracksQuery.isLoading;

  return (
    <div>
      <PageHeader
        title="Tracks"
        subtitle={`Everything in ${activeSpace?.name ?? "this space"}.`}
        actions={
          <Button
            size="sm"
            disabled={!activeSpaceId || stages.length === 0}
            onClick={() => setModalOpen(true)}
          >
            <Plus className="size-3.5" />
            Track
          </Button>
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
          copy="Start a track and park it on the board."
          action={
            <Button onClick={() => setModalOpen(true)}>
              <Plus className="size-3.5" />
              Start a track
            </Button>
          }
        />
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
                  onClick={() => router.push(`/track/${track.id}`)}
                  className="well lift flex w-full items-center gap-3 p-3 text-left"
                >
                  {/* Artwork lives in the private `audio` bucket, so the path
                      must be signed — a raw <img src={path}> never resolves.
                      Gradient stays underneath as the fallback. */}
                  <span
                    className="relative size-10 shrink-0 overflow-hidden rounded-input border border-line shadow-e1"
                    style={{ background: gradientFromTrackId(track.id) }}
                  >
                    <SignedImage
                      path={track.artwork_url}
                      className="absolute inset-0 size-full"
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
          onOpenChange={setModalOpen}
          spaceId={activeSpaceId}
          stages={stages}
          onSubmit={handleSubmit}
        />
      ) : null}
    </div>
  );
}
