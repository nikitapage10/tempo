"use client";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useActiveSpace } from "@/components/active-space-provider";
import { useToast } from "@/components/ui/toast";
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
import { TrackWorkspaceShell } from "@/components/track/track-workspace-shell";
import { ModularWorkspace } from "@/components/track/modular-workspace";
import { LayoutToolbar } from "@/components/track/layout-toolbar";
import { TrackEditMenu } from "@/components/track/track-edit-menu";
import {
  VersionPlayer,
  type VersionPlayerHandle,
  type WaveformMarker,
} from "@/components/track/version-player";
import { VersionTimeline } from "@/components/track/version-timeline";
import { useCollaborators, useTrackPermissions } from "@/hooks/use-collaborators";
import { useComments, useUnresolvedCommentCount } from "@/hooks/use-comments";
import { useStagesWithRecipes } from "@/hooks/use-recipes";
import { useStages } from "@/hooks/use-stages";
import { useStageTransitionController } from "@/hooks/use-stage-transition";
import {
  useTrack,
  useTrackMutations,
  useTracks,
  useVersionCount,
} from "@/hooks/use-tracks";
import { useVersions } from "@/hooks/use-versions";
import {
  useResolvedPreference,
  useWorkspacePrefMutations,
} from "@/hooks/use-workspace-prefs";
import {
  useLayoutTemplateMutations,
  useLayoutTemplates,
} from "@/hooks/use-layout-templates";
import {
  ALWAYS_VISIBLE_WITH_VERSIONS,
  DEFAULT_LAYOUT,
  PRESET_DEFAULTS,
  effectivePresetShape,
  layoutFromStored,
  type ModuleId,
  type ModuleLayout,
} from "@/lib/workspace-presets";
import type { TrackUpdate, WorkspacePreset } from "@/lib/types";

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
  const searchParams = useSearchParams();
  const calendarEdit = searchParams.get("edit");
  const { setActiveSpaceId } = useActiveSpace();

  const trackQuery = useTrack(trackId);
  const versionQuery = useVersionCount(trackId);
  const versionsQuery = useVersions(trackId);
  const track = trackQuery.data;
  const siblingTracksQuery = useTracks(track?.space_id ?? null);
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

  const adjacentTracks = React.useMemo(() => {
    const tracks = siblingTracksQuery.data ?? [];
    const index = tracks.findIndex((item) => item.id === trackId);
    if (index < 0) return { previous: null, next: null };
    return {
      previous: tracks[index - 1] ?? null,
      next: tracks[index + 1] ?? null,
    };
  }, [siblingTracksQuery.data, trackId]);

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

  // Layout editing. The draft is local until saved, so an abandoned edit
  // never touches the stored preference.
  const [editing, setEditing] = React.useState(false);
  const [confirmDeleteTrack, setConfirmDeleteTrack] = React.useState(false);
  const [draftLayout, setDraftLayout] = React.useState<ModuleLayout>(
    DEFAULT_LAYOUT
  );
  const [draftPreset, setDraftPreset] =
    React.useState<WorkspacePreset>("production");
  const { save: savePref } = useWorkspacePrefMutations();
  const templatesQuery = useLayoutTemplates();
  const templateMutations = useLayoutTemplateMutations();
  const { toast } = useToast();

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

  // Comments is a module now rather than a tab, so "add comment here" scrolls
  // to wherever the musician has placed it instead of switching a panel.
  const scrollToComments = React.useCallback(() => {
    document
      .getElementById("module-comments")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

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

  function beginEditing() {
    setDraftLayout(layout.layout);
    setDraftPreset(prefQuery.data?.preset ?? "production");
    setEditing(true);
  }

  async function persistLayout(next: ModuleLayout, preset?: WorkspacePreset) {
    await savePref.mutateAsync({
      trackId,
      preset: preset ?? prefQuery.data?.preset ?? "custom",
      moduleLayout: next,
    });
  }

  async function handleSaveLayout() {
    try {
      await persistLayout(draftLayout, draftPreset);
      setEditing(false);
      toast("Layout saved", "ok");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn’t save layout.");
    }
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

  // Every movable section of the workspace, keyed by module id. A null entry
  // (no permission, nothing to show) is skipped by ModularWorkspace.
  const moduleNodes: Partial<Record<ModuleId, React.ReactNode>> = {
    player: (
      <VersionPlayer
        ref={playerRef}
        trackId={track.id}
        trackTitle={track.title}
        versions={versions}
        selectedId={selectedVersionId}
        onSelect={setSelectedVersionId}
        spotifyTrackId={track.spotify_track_id}
        spotifyUrl={track.spotify_url}
        markers={markers}
        onMarkerClick={(id) => {
          const marker = markers.find((m) => m.id === id);
          if (marker && selectedVersionId) {
            handleRequestSeek(selectedVersionId, marker.timestampSec);
          }
        }}
        onAddCommentClick={(seconds) => {
          setPrefillTimestamp(seconds);
          scrollToComments();
        }}
        onTimeUpdate={setPlayerTime}
      />
    ),
    versions: (
      <VersionTimeline
        trackId={track.id}
        playingId={selectedVersionId}
        onPlay={setSelectedVersionId}
        canUpload={permissions.canUpload}
        canManage={permissions.canSetCurrentOrPin}
      />
    ),
    workflow: (
      <TrackWorkflowStrip
        track={track}
        onPatch={onPatch}
        unresolvedCommentCount={unresolvedCommentsQuery.data ?? 0}
        autoEdit={
          calendarEdit === "deadline" || calendarEdit === "next-action"
            ? calendarEdit
            : null
        }
      />
    ),
    guestLinks: permissions.isOwner ? (
      <GuestLinksPanel
        trackId={track.id}
        versions={versions}
        selectedVersionId={selectedVersionId}
      />
    ) : null,
    sessionLog: <SessionLog trackId={track.id} />,
    work: <TrackChecklist trackId={track.id} />,
    files: <AssetsPanel trackId={track.id} />,
    notes: <TrackNotes notes={track.notes} onPatch={onPatch} />,
    comments: (
      <div id="module-comments">
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
      </div>
    ),
    references: <ReferencesPanel trackId={track.id} />,
    people: (
      <PeoplePanel
        trackId={track.id}
        ownerUserId={track.user_id}
        isOwner={permissions.isOwner}
      />
    ),
    activity: <ActivityPanel trackId={track.id} />,
    // Delete deliberately does NOT live here — Details is an optional module and
    // most layouts hide it, which left the only way to delete a track buried.
    // It sits in the always-visible toolbar instead.
    details: (
      <TrackDetails
        track={track}
        onPatch={onPatch}
        readOnly={!permissions.canEditMetadata}
      />
    ),
  };

  return (
    <>
      <TrackWorkspaceShell
      header={
        <TrackAmbientHeader
          track={track}
          stages={stages}
          versionCount={versionQuery.data ?? 0}
          onPatch={onPatch}
          navigation={
            siblingTracksQuery.isLoading ||
            (adjacentTracks.previous == null && adjacentTracks.next == null)
              ? null
              : (
                  <TrackSiblingNavigation
                    previous={adjacentTracks.previous}
                    next={adjacentTracks.next}
                  />
                )
          }
          onStageChange={(stageId) =>
            void changeStage(track.id, stageId, {
              trackTitle: track.title,
              fromStageId: track.stage_id,
            })
          }
          actions={
            editing ? null : (
              <TrackEditMenu
                onEditLayout={beginEditing}
                extras={
                  permissions.canDeleteTrack
                    ? ({ closeMenu }) => (
                        <button
                          type="button"
                          role="menuitem"
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-warn transition-colors duration-hover hover:bg-bg-3 focus-visible:bg-bg-3 focus-visible:outline-none"
                          onClick={() => {
                            closeMenu();
                            setConfirmDeleteTrack(true);
                          }}
                        >
                          <Trash2 className="size-3.5" />
                          Delete track
                        </button>
                      )
                    : undefined
                }
              />
            )
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
      toolbar={
        <>
          <ActiveSessionBanner excludeTrackId={track.id} />
          <LayoutToolbar
            editing={editing}
            preset={draftPreset}
            saving={savePref.isPending}
            onEdit={beginEditing}
            onCancel={() => setEditing(false)}
            onSave={() => void handleSaveLayout()}
            onReset={() => {
              setDraftLayout(PRESET_DEFAULTS.production.layout);
              setDraftPreset("production");
            }}
            onApplyPreset={(p) => {
              setDraftLayout(PRESET_DEFAULTS[p].layout);
              setDraftPreset(p);
            }}
            templates={templatesQuery.data ?? []}
            onApplyTemplate={(t) => {
              setDraftLayout(layoutFromStored(t.layout));
              setDraftPreset("custom");
            }}
            onSaveTemplate={async (name) => {
              try {
                await templateMutations.create.mutateAsync({
                  name,
                  layout: draftLayout,
                });
                toast(`Saved “${name}”`, "ok");
              } catch (err) {
                toast(
                  err instanceof Error
                    ? err.message
                    : "Couldn’t save that template."
                );
              }
            }}
            onDeleteTemplate={async (t) => {
              try {
                await templateMutations.remove.mutateAsync(t.id);
                toast(`Deleted “${t.name}”`, "ok");
              } catch (err) {
                toast(
                  err instanceof Error
                    ? err.message
                    : "Couldn’t delete that template."
                );
              }
            }}
          />
        </>
      }
      content={
        <ModularWorkspace
          layout={editing ? draftLayout : layout.layout}
          modules={moduleNodes}
          editing={editing}
          onChange={(next) => {
            if (editing) {
              setDraftLayout(next);
              setDraftPreset("custom");
            } else {
              // Only the splitter can fire this outside edit mode; persist the
              // new width straight away so it survives a reload.
              persistLayout(next).catch((err) =>
                toast(
                  err instanceof Error
                    ? err.message
                    : "Couldn’t save column width."
                )
              );
            }
          }}
          lockedModule={
            versions.length > 0 ? ALWAYS_VISIBLE_WITH_VERSIONS : null
          }
          badges={{
            comments: unresolvedCommentsQuery.data ?? 0,
            people: activeCollaboratorCount,
          }}
          compact={layout.compactMode}
        />
      }
    />
    {stageTransitionDialog}

    {/* Deleting takes the bounces and feedback with it — name what's going. */}
    <Dialog open={confirmDeleteTrack} onOpenChange={setConfirmDeleteTrack}>
      <DialogContent
        title={`Delete “${track.title}”?`}
        description="Its bounces, comments, checklists, and session history go too. This can't be undone."
        onClose={() => setConfirmDeleteTrack(false)}
      >
        <div className="mt-4 flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={remove.isPending}
            onClick={() => setConfirmDeleteTrack(false)}
          >
            Keep it
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={remove.isPending}
            onClick={async () => {
              try {
                await remove.mutateAsync(track.id);
                router.push("/board");
              } catch (err) {
                toast(
                  err instanceof Error ? err.message : "Couldn’t delete that track."
                );
              }
            }}
          >
            {remove.isPending ? "Deleting…" : "Delete track"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}

function TrackSiblingNavigation({
  previous,
  next,
}: {
  previous: { id: string; title: string } | null;
  next: { id: string; title: string } | null;
}) {
  return (
    <nav aria-label="Move between tracks" className="flex items-center gap-1">
      {previous ? (
        <Link
          href={`/track/${previous.id}`}
          title={`Previous track: ${previous.title}`}
          aria-label={`Previous track: ${previous.title}`}
          className="inline-flex h-8 items-center gap-1 rounded-chip border border-line bg-bg-0/45 px-2 text-xs text-text-lo transition-colors hover:border-ice/40 hover:text-ice focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
        >
          <ChevronLeft className="size-3.5" />
          <span className="hidden sm:inline">Previous</span>
        </Link>
      ) : (
        <span
          aria-hidden="true"
          className="inline-flex h-8 items-center gap-1 rounded-chip border border-line/50 px-2 text-xs text-text-lo/35"
        >
          <ChevronLeft className="size-3.5" />
          <span className="hidden sm:inline">Previous</span>
        </span>
      )}

      {next ? (
        <Link
          href={`/track/${next.id}`}
          title={`Next track: ${next.title}`}
          aria-label={`Next track: ${next.title}`}
          className="inline-flex h-8 items-center gap-1 rounded-chip border border-line bg-bg-0/45 px-2 text-xs text-text-lo transition-colors hover:border-ice/40 hover:text-ice focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="size-3.5" />
        </Link>
      ) : (
        <span
          aria-hidden="true"
          className="inline-flex h-8 items-center gap-1 rounded-chip border border-line/50 px-2 text-xs text-text-lo/35"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="size-3.5" />
        </span>
      )}
    </nav>
  );
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
