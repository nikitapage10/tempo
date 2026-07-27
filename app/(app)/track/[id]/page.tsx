"use client";

import * as React from "react";
import { Suspense } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useActiveSpace } from "@/components/active-space-provider";
import { ActiveSessionBanner } from "@/components/track/active-session-banner";
import { ActivityPanel } from "@/components/track/activity-panel";
import { AssetsPanel } from "@/components/track/assets-panel";
import { CommentsPanel } from "@/components/track/comments-panel";
import { GuestLinksPanel } from "@/components/track/guest-links-panel";
import { PeoplePanel } from "@/components/track/people-panel";
import { ReferencesPanel } from "@/components/track/references-panel";
import { SessionLog } from "@/components/track/session-log";
import { TrackAmbientHeader } from "@/components/track/track-ambient-header";
import { TrackChecklist } from "@/components/track/track-checklist";
import { TrackDetails } from "@/components/track/track-details";
import { TrackNotes } from "@/components/track/track-notes";
import { TrackStageTimeline } from "@/components/track/track-stage-timeline";
import { TrackWorkflowStrip } from "@/components/track/track-workflow-strip";
import { TrackWorkPanel } from "@/components/track/track-work-panel";
import { TrackWorkspaceShell } from "@/components/track/track-workspace-shell";
import {
  VersionPlayer,
  type VersionPlayerHandle,
  type WaveformMarker,
} from "@/components/track/version-player";
import { VersionTimeline } from "@/components/track/version-timeline";
import { WorkspaceCustomizeButton } from "@/components/track/workspace-customize";
import { useCollaborators, useTrackPermissions } from "@/hooks/use-collaborators";
import { useComments, useUnresolvedCommentCount } from "@/hooks/use-comments";
import { useStagesWithRecipes } from "@/hooks/use-recipes";
import { useStages } from "@/hooks/use-stages";
import { useStageTransitionController } from "@/hooks/use-stage-transition";
import {
  useTrack,
  useTrackMutations,
  useVersionCount,
} from "@/hooks/use-tracks";
import { useVersions } from "@/hooks/use-versions";
import { useResolvedPreference } from "@/hooks/use-workspace-prefs";
import {
  ALWAYS_VISIBLE_WITH_VERSIONS,
  effectivePresetShape,
  type ModuleId,
} from "@/lib/workspace-presets";
import type { TrackUpdate } from "@/lib/types";

export default function TrackDetailPage() {
  return (
    <Suspense fallback={<TrackWorkspaceSkeleton />}>
      <TrackDetailContent />
    </Suspense>
  );
}

function TrackDetailContent() {
  const params = useParams<{ id: string }>();
  const trackId = params.id;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { setActiveSpaceId } = useActiveSpace();

  const trackQuery = useTrack(trackId);
  const versionQuery = useVersionCount(trackId);
  const versionsQuery = useVersions(trackId);
  const track = trackQuery.data;
  const stagesQuery = useStages(track?.space_id ?? null);
  const { update, remove } = useTrackMutations(track?.space_id ?? null);
  const unresolvedCommentsQuery = useUnresolvedCommentCount(trackId);
  const { changeStage, dialog: stageTransitionDialog } =
    useStageTransitionController(track?.space_id ?? null);
  const { data: recipeStageIds } = useStagesWithRecipes(
    (stagesQuery.data ?? []).map((s) => s.id)
  );
  const permissions = useTrackPermissions(track?.user_id, trackId);
  const { data: collaborators = [] } = useCollaborators(trackId);
  const activeCollaboratorCount = collaborators.filter((c) => c.status === "active").length;
  const prefQuery = useResolvedPreference({
    trackId,
    stageId: track?.stage_id ?? null,
  });
  const layout = effectivePresetShape(prefQuery.data ?? null);

  const [selectedVersionId, setSelectedVersionId] = React.useState<
    string | null
  >(null);
  const [pendingSeek, setPendingSeek] = React.useState<{
    versionId: string;
    seconds: number;
  } | null>(null);
  const [prefillTimestamp, setPrefillTimestamp] = React.useState<
    number | null
  >(null);
  const [playerTime, setPlayerTime] = React.useState(0);
  const playerRef = React.useRef<VersionPlayerHandle>(null);

  // Marker-only fetch scoped to the loaded waveform's version (FEATURE-SPECS §4).
  const markerCommentsQuery = useComments(trackId, selectedVersionId ?? "all");

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

  // Resolve a queued cross-version seek once the target version becomes selected
  // (VersionPlayer queues the actual `setTime` call until its waveform is ready).
  React.useEffect(() => {
    if (pendingSeek && pendingSeek.versionId === selectedVersionId) {
      playerRef.current?.seekTo(pendingSeek.seconds);
      setPendingSeek(null);
    }
  }, [selectedVersionId, pendingSeek]);

  const handleRequestSeek = React.useCallback(
    (versionId: string, seconds: number) => {
      if (versionId === selectedVersionId) {
        playerRef.current?.seekTo(seconds);
      } else {
        setPendingSeek({ versionId, seconds });
        setSelectedVersionId(versionId);
      }
    },
    [selectedVersionId]
  );

  const openCommentsTab = React.useCallback(() => {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("panel", "comments");
    router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false });
  }, [pathname, router, searchParams]);

  const markers: WaveformMarker[] = React.useMemo(() => {
    if (!selectedVersionId) return [];
    return (markerCommentsQuery.data ?? [])
      .filter(
        (c) =>
          !c.parent_id &&
          c.version_id === selectedVersionId &&
          c.timestamp_sec != null
      )
      .map((c) => ({
        id: c.id,
        timestampSec: c.timestamp_sec as number,
        resolved: c.resolved,
        title: c.text,
      }));
  }, [markerCommentsQuery.data, selectedVersionId]);

  async function onPatch(patch: TrackUpdate) {
    if (!track) return;
    await update.mutateAsync({ id: track.id, patch });
  }

  if (trackQuery.isLoading) {
    return <TrackWorkspaceSkeleton />;
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
    <>
      <TrackWorkspaceShell
      header={
        <TrackAmbientHeader
          track={track}
          stages={stages}
          versionCount={versionQuery.data ?? 0}
          onPatch={onPatch}
          onStageChange={(stageId) =>
            void changeStage(track.id, stageId, {
              trackTitle: track.title,
              fromStageId: track.stage_id,
            })
          }
        />
      }
      timeline={
        <TrackStageTimeline
          stages={stages}
          currentStageId={track.stage_id}
          onStageChange={(stageId) =>
            void changeStage(track.id, stageId, {
              trackTitle: track.title,
              fromStageId: track.stage_id,
            })
          }
          isError={stagesQuery.isError}
          disabled={update.isPending || !permissions.canChangeWorkflow}
          recipeStageIds={recipeStageIds}
        />
      }
      primary={
        <div className={layout.compactMode ? "space-y-3" : "space-y-4"}>
          <div className="flex justify-end">
            <WorkspaceCustomizeButton
              trackId={track.id}
              stageId={track.stage_id}
              hasVersions={versions.length > 0}
            />
          </div>
          <ActiveSessionBanner excludeTrackId={track.id} />
          <VersionPlayer
            ref={playerRef}
            trackId={track.id}
            versions={versions}
            selectedId={selectedVersionId}
            onSelect={setSelectedVersionId}
            markers={markers}
            onMarkerClick={(id) => {
              const marker = markers.find((m) => m.id === id);
              if (marker && selectedVersionId) {
                handleRequestSeek(selectedVersionId, marker.timestampSec);
              }
            }}
            onAddCommentClick={(seconds) => {
              setPrefillTimestamp(seconds);
              openCommentsTab();
            }}
            onTimeUpdate={setPlayerTime}
          />
          {orderedModules(layout.moduleOrder, layout.hiddenModules, versions.length > 0).map(
            (mod) => {
              if (mod === "versions") {
                return (
                  <VersionTimeline
                    key={mod}
                    trackId={track.id}
                    playingId={selectedVersionId}
                    onPlay={setSelectedVersionId}
                    canUpload={permissions.canUpload}
                    canManage={permissions.canSetCurrentOrPin}
                  />
                );
              }
              if (mod === "guestLinks") {
                return permissions.isOwner ? (
                  <GuestLinksPanel
                    key={mod}
                    trackId={track.id}
                    versions={versions}
                    selectedVersionId={selectedVersionId}
                  />
                ) : null;
              }
              if (mod === "workflow") {
                return (
                  <TrackWorkflowStrip
                    key={mod}
                    track={track}
                    onPatch={onPatch}
                    unresolvedCommentCount={unresolvedCommentsQuery.data ?? 0}
                  />
                );
              }
              return <SessionLog key={mod} trackId={track.id} />;
            }
          )}
        </div>
      }
      panel={
        <TrackWorkPanel
          defaultTab={layout.defaultPanel}
          work={<TrackChecklist trackId={track.id} />}
          files={<AssetsPanel trackId={track.id} />}
          notes={<TrackNotes notes={track.notes} onPatch={onPatch} />}
          comments={
            <CommentsPanel
              trackId={track.id}
              versions={versions}
              selectedVersionId={selectedVersionId}
              ownerUserId={track.user_id}
              onRequestSeek={handleRequestSeek}
              currentTimeSec={playerTime}
              prefillTimestampSec={prefillTimestamp}
              onPrefillConsumed={() => setPrefillTimestamp(null)}
            />
          }
          commentsCount={unresolvedCommentsQuery.data ?? 0}
          references={<ReferencesPanel trackId={track.id} />}
          people={
            <PeoplePanel
              trackId={track.id}
              ownerUserId={track.user_id}
              isOwner={permissions.isOwner}
            />
          }
          peopleCount={activeCollaboratorCount}
          activity={<ActivityPanel trackId={track.id} />}
          details={
            <div className="space-y-4">
              <TrackDetails
                track={track}
                onPatch={onPatch}
                readOnly={!permissions.canEditMetadata}
              />
              {permissions.canDeleteTrack ? (
                <div className="flex justify-end rounded-card border border-line bg-bg-1 p-4">
                  <DeleteTrackButton
                    onDelete={async () => {
                      await remove.mutateAsync(track.id);
                      router.push("/board");
                    }}
                  />
                </div>
              ) : null}
            </div>
          }
        />
      }
    />
    {stageTransitionDialog}
    </>
  );
}

function orderedModules(
  order: ModuleId[],
  hidden: ModuleId[],
  hasVersions: boolean
): ModuleId[] {
  return order.filter((id) => {
    if (hasVersions && id === ALWAYS_VISIBLE_WITH_VERSIONS) return true;
    return !hidden.includes(id);
  });
}

function TrackWorkspaceSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-36 animate-pulse rounded-card border border-line bg-bg-1" />
      <div className="h-14 animate-pulse rounded-card border border-line bg-bg-1" />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="h-44 animate-pulse rounded-card border border-line bg-bg-1" />
          <div className="h-32 animate-pulse rounded-card border border-line bg-bg-1" />
        </div>
        <div className="h-64 animate-pulse rounded-card border border-line bg-bg-1" />
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
