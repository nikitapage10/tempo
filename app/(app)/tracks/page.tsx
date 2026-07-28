"use client";

import * as React from "react";
import { Plus, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActiveSpace } from "@/components/active-space-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/ui/page-header";
import { SignedImage } from "@/components/ui/signed-image";
import { SpotlightCard } from "@/components/ui/spotlight-card";
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
  const { create, remove } = useTrackMutations(activeSpaceId);
  const { toast } = useToast();

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

  // Multi-select is off until asked for — clicking a row should open a track,
  // not arm a destructive action.
  const [selecting, setSelecting] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

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

    // Deleted one at a time so a single failure doesn't take the rest with it,
    // and the artist is told exactly how far it got.
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
      toast(`Deleted ${ids.length - failed} of ${ids.length}. ${failed} couldn’t be removed.`);
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
                <Button size="sm" variant="ghost" onClick={() => setSelecting(true)}>
                  Select
                </Button>
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
      ) : (
        <ul className="space-y-2">
          {tracks.map((track) => {
            const meta: string[] = [];
            if (track.bpm != null) meta.push(`${track.bpm} BPM`);
            if (track.musical_key) meta.push(track.musical_key);
            return (
              <SpotlightCard
                as="li"
                key={track.id}
                tone={track.blocked_reason?.trim() ? "warn" : "ramp"}
                radius={12}
                size={240}
              >
                <button
                  type="button"
                  aria-pressed={selecting ? selected.has(track.id) : undefined}
                  onClick={() =>
                    selecting ? toggleSelected(track.id) : router.push(`/track/${track.id}`)
                  }
                  className={cn(
                    "well lift relative flex w-full items-center gap-4 p-4 text-left",
                    selecting && selected.has(track.id) && "!border-ice/40 !bg-ice/5",
                  )}
                >
                  {selecting ? (
                    <span
                      aria-hidden
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors duration-hover",
                        selected.has(track.id)
                          ? "border-ice bg-ice text-bg-0"
                          : "border-line bg-bg-0",
                      )}
                    >
                      {selected.has(track.id) ? (
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

                  {/* Artwork lives in the private `audio` bucket, so the path
                      must be signed — a raw <img src={path}> never resolves.
                      Gradient stays underneath as the fallback. */}
                  <span
                    className="relative size-14 shrink-0 overflow-hidden rounded-input border border-line shadow-e1"
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
                    {/* The line that makes this list worth scanning: what's
                        actually next on this track, or why it's stuck. */}
                    <span className="mt-1.5 block truncate text-[11px]">
                      {track.blocked_reason?.trim() ? (
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

                  {/* Stage as a right-aligned anchor so the eye can run down
                      the pipeline column instead of hunting mid-row. */}
                  <span className="hidden shrink-0 text-right sm:block">
                    <span className="label-mono">Stage</span>
                    <span className="mt-1 block text-xs text-text-hi">
                      {stageName(track.stage_id)}
                    </span>
                  </span>
                </button>
              </SpotlightCard>
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

      {/* Deleting a track takes its bounces and feedback with it, so say so
          plainly and name what's going before asking them to confirm. */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent
          title={`Delete ${selected.size} track${selected.size === 1 ? "" : "s"}?`}
          description="Their bounces, comments, checklists, and session history go too. This can't be undone."
          onClose={() => setConfirmDelete(false)}
        >
          <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto">
            {selectedTracks.map((track) => (
              <li key={track.id} className="well truncate px-3 py-1.5 text-xs text-text-hi">
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
