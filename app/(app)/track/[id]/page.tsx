"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useActiveSpace } from "@/components/active-space-provider";
import { AssetsPanel } from "@/components/track/assets-panel";
import { SessionLog } from "@/components/track/session-log";
import { TrackChecklist } from "@/components/track/track-checklist";
import { TrackDetails } from "@/components/track/track-details";
import { TrackHeader } from "@/components/track/track-header";
import { TrackNotes } from "@/components/track/track-notes";
import { VersionPlayer } from "@/components/track/version-player";
import { VersionsPanel } from "@/components/track/versions-panel";
import { useStages } from "@/hooks/use-stages";
import {
  useTrack,
  useTrackMutations,
  useVersionCount,
} from "@/hooks/use-tracks";
import { useVersions } from "@/hooks/use-versions";
import type { TrackUpdate } from "@/lib/types";

export default function TrackDetailPage() {
  const params = useParams<{ id: string }>();
  const trackId = params.id;
  const router = useRouter();
  const { setActiveSpaceId } = useActiveSpace();

  const trackQuery = useTrack(trackId);
  const versionQuery = useVersionCount(trackId);
  const versionsQuery = useVersions(trackId);
  const track = trackQuery.data;
  const stagesQuery = useStages(track?.space_id ?? null);
  const { update, remove } = useTrackMutations(track?.space_id ?? null);

  const [selectedVersionId, setSelectedVersionId] = React.useState<
    string | null
  >(null);

  React.useEffect(() => {
    if (track?.space_id) setActiveSpaceId(track.space_id);
  }, [track?.space_id, setActiveSpaceId]);

  React.useEffect(() => {
    const versions = versionsQuery.data;
    if (!versions?.length) return;
    if (
      selectedVersionId &&
      versions.some((v) => v.id === selectedVersionId)
    ) {
      return;
    }
    const current = versions.find((v) => v.is_current) ?? versions[0];
    setSelectedVersionId(current.id);
  }, [versionsQuery.data, selectedVersionId]);

  async function onPatch(patch: TrackUpdate) {
    if (!track) return;
    await update.mutateAsync({ id: track.id, patch });
  }

  if (trackQuery.isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-36 animate-pulse rounded-card border border-line bg-bg-1" />
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <div className="h-40 animate-pulse rounded-card border border-line bg-bg-1" />
            <div className="h-48 animate-pulse rounded-card border border-line bg-bg-1" />
          </div>
          <div className="h-64 animate-pulse rounded-card border border-line bg-bg-1" />
        </div>
      </div>
    );
  }

  if (trackQuery.isError || !track) {
    return (
      <div className="rounded-card border border-line bg-bg-1 px-6 py-12 text-center">
        <p className="text-sm text-text-lo">
          Couldn’t find that track. It may have been deleted.
        </p>
        <button
          type="button"
          className="mt-4 text-sm text-ice hover:underline"
          onClick={() => router.push("/board")}
        >
          Back to board
        </button>
      </div>
    );
  }

  const stages = stagesQuery.data ?? [];
  const versions = versionsQuery.data ?? [];

  return (
    <div className="space-y-5">
      <TrackHeader
        track={track}
        stages={stages}
        versionCount={versionQuery.data ?? 0}
        onPatch={onPatch}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <VersionPlayer
            trackId={track.id}
            versions={versions}
            selectedId={selectedVersionId}
            onSelect={setSelectedVersionId}
          />
          <VersionsPanel
            trackId={track.id}
            playingId={selectedVersionId}
            onPlay={setSelectedVersionId}
          />
          <SessionLog trackId={track.id} />
        </div>

        <div className="space-y-4">
          <TrackChecklist trackId={track.id} />
          <AssetsPanel trackId={track.id} />
          <TrackNotes notes={track.notes} onPatch={onPatch} />
          <TrackDetails track={track} onPatch={onPatch} />

          <div className="flex justify-end pt-1">
            <DeleteTrackButton
              onDelete={async () => {
                await remove.mutateAsync(track.id);
                router.push("/board");
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function DeleteTrackButton({ onDelete }: { onDelete: () => Promise<void> }) {
  const [confirm, setConfirm] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  if (!confirm) {
    return (
      <button
        type="button"
        className="text-xs text-text-lo transition-colors duration-hover hover:text-warn"
        onClick={() => setConfirm(true)}
      >
        Delete track
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-warn">Delete for good?</span>
      <button
        type="button"
        disabled={busy}
        className="text-warn hover:underline disabled:opacity-50"
        onClick={async () => {
          setBusy(true);
          try {
            await onDelete();
          } finally {
            setBusy(false);
          }
        }}
      >
        Yes, delete
      </button>
      <button
        type="button"
        className="text-text-lo hover:text-text-hi"
        onClick={() => setConfirm(false)}
      >
        Cancel
      </button>
    </div>
  );
}
