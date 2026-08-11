"use client";

import * as React from "react";
import {
  CheckCircle2,
  ChevronDown,
  Download,
  GitCompare,
  HardDrive,
  MonitorSmartphone,
  Pin,
  PinOff,
  Play,
  ScrollText,
  Trash2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Dropzone } from "@/components/ui/dropzone";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { BlindAB } from "@/components/track/blind-ab";
import { useActivity } from "@/hooks/use-activity";
import { useVersionCommentCount } from "@/hooks/use-comments";
import { useDecisionMutations, useDecisions } from "@/hooks/use-decisions";
import { useGuestLinks } from "@/hooks/use-guest-links";
import { useVersionMutations, useVersions } from "@/hooks/use-versions";
import {
  AUDIO_ACCEPT,
  DECISION_AREAS,
  DECISION_TYPES,
  MILESTONE_TYPES,
} from "@/lib/constants";
import { formatFileSize, formatShortDate } from "@/lib/format";
import { getSignedUrl } from "@/lib/storage";
import { isDesktopApp, vaultHas } from "@/lib/desktop/bridge";
import type {
  DecisionArea,
  DecisionType,
  GuestReviewLink,
  MilestoneType,
  Version,
  VersionDecision,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type VersionTimelineProps = {
  trackId: string;
  onPlay: (versionId: string) => void;
  playingId: string | null;
  /** Owner/editor/uploader can add bounces; others just play/read (SECURITY-AND-PERMISSIONS.md §3). */
  canUpload?: boolean;
  /** Owner/editor can pin, set current, or delete versions. */
  canManage?: boolean;
};

const DECISION_TONE: Record<
  DecisionType,
  { icon: React.ComponentType<{ className?: string }>; className: string }
> = {
  approved: { icon: CheckCircle2, className: "text-ok" },
  needs_changes: { icon: ScrollText, className: "text-amber" },
  rejected: { icon: XCircle, className: "text-warn" },
};

function isLinkActive(link: GuestReviewLink): boolean {
  if (link.revoked_at) return false;
  if (link.expires_at && new Date(link.expires_at).getTime() <= Date.now()) {
    return false;
  }
  return true;
}

export function VersionTimeline({
  trackId,
  onPlay,
  playingId,
  canUpload = true,
  canManage = true,
}: VersionTimelineProps) {
  const { data: versions = [], isLoading } = useVersions(trackId);
  const { upload, setCurrent, remove, pin, unpin } =
    useVersionMutations(trackId);
  const { data: decisions = [] } = useDecisions(trackId);
  const { data: guestLinks = [] } = useGuestLinks(trackId);
  const { data: activity = [] } = useActivity(trackId);
  const { toast } = useToast();

  const uploaderByVersionId = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const event of activity) {
      if (event.event_type === "version_uploaded" && event.entity_id && event.actor_label) {
        map.set(event.entity_id, event.actor_label);
      }
    }
    return map;
  }, [activity]);

  const [changelog, setChangelog] = React.useState("");
  const [progress, setProgress] = React.useState<number | null>(null);
  const [phase, setPhase] = React.useState<"converting" | "uploading" | null>(
    null
  );
  const [error, setError] = React.useState<string | null>(null);

  const [compareIds, setCompareIds] = React.useState<string[]>([]);
  const [abOpen, setAbOpen] = React.useState(false);
  const [pinTarget, setPinTarget] = React.useState<Version | null>(null);
  const [decisionTarget, setDecisionTarget] = React.useState<Version | null>(
    null
  );
  const [deleteTarget, setDeleteTarget] = React.useState<Version | null>(
    null
  );
  const [historyFor, setHistoryFor] = React.useState<string | null>(null);

  const decisionsByVersion = React.useMemo(() => {
    const map = new Map<string, VersionDecision[]>();
    for (const d of decisions) {
      const list = map.get(d.version_id) ?? [];
      list.push(d);
      map.set(d.version_id, list);
    }
    return map;
  }, [decisions]);

  function activeGuestLinksFor(versionId: string) {
    return guestLinks.filter(
      (l) => l.version_id === versionId && isLinkActive(l)
    );
  }

  async function handleFiles(files: FileList | File[] | null) {
    const file = files?.[0];
    if (!file) return;
    setError(null);
    setProgress(0);
    setPhase(null);
    try {
      const version = await upload.mutateAsync({
        file,
        changelog,
        onProgress: setProgress,
        onPhase: setPhase,
      });
      setChangelog("");
      setProgress(null);
      setPhase(null);
      onPlay(version.id);
      toast(`Uploaded v${version.version_no}`, "ok");
    } catch (err) {
      setProgress(null);
      setPhase(null);
      const msg =
        err instanceof Error
          ? err.message
          : "Upload failed — try again, or pick a different file.";
      setError(msg);
      toast(msg);
    }
  }

  async function handleDownload(v: Version) {
    try {
      const url = await getSignedUrl(v.file_url);
      const a = document.createElement("a");
      a.href = url;
      a.download = v.label || `v${v.version_no}`;
      a.rel = "noopener";
      a.target = "_blank";
      a.click();
    } catch (err) {
      toast(
        err instanceof Error
          ? err.message
          : "Download failed — sign in again, then retry."
      );
    }
  }

  function toggleCompare(id: string) {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      const next = [...prev, id];
      return next.length > 2 ? next.slice(1) : next;
    });
  }

  async function handleUnpin(v: Version) {
    try {
      await unpin.mutateAsync(v.id);
      toast(`v${v.version_no} unpinned`, "ok");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn’t unpin version.");
    }
  }

  return (
    <section className="panel p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-lo">
          Versions
        </h2>
        {versions.length >= 2 ? (
          <button
            type="button"
            className="flex items-center gap-1 text-[11px] text-ice hover:underline"
            onClick={() => setCompareIds([])}
          >
            <GitCompare className="size-3.5" />
            Blind A/B
          </button>
        ) : null}
      </div>

      {canUpload ? (
      <Dropzone
        className="p-4"
        accept={AUDIO_ACCEPT}
        disabled={progress != null}
        onFiles={(files) => void handleFiles(files)}
      >
        {({ open }) => (
        <>
        <p className="text-sm text-text-hi">Upload a bounce</p>
        <p className="mt-1 text-xs text-text-lo">
          mp3 / wav / aiff / m4a · up to 200 MB · every version stays in your
          history; the cloud keeps just the current bounce and the one
          before it. Wav and aiff are converted to mp3 in your browser before
          upload.
        </p>
        <div className="mt-3 space-y-2">
          <Label htmlFor={`changelog-${trackId}`}>What changed?</Label>
          <Input
            id={`changelog-${trackId}`}
            value={changelog}
            onChange={(e) => setChangelog(e.target.value)}
            placeholder="Reworked drop, louder vocal…"
            disabled={progress != null}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            disabled={progress != null}
            onClick={open}
          >
            {progress != null
              ? phase === "converting"
                ? `Converting ${progress}%`
                : `Uploading ${progress}%`
              : "Upload new version"}
          </Button>
          {progress != null ? (
            <div className="h-1.5 w-32 overflow-hidden rounded-full bg-bg-0">
              <div
                className="h-full rounded-full bg-gradient-to-r from-ice to-amber transition-all duration-hover"
                style={{ width: `${progress}%` }}
              />
            </div>
          ) : null}
        </div>
        {error ? (
          <p className="mt-2 text-sm text-warn" role="alert">
            {error}
          </p>
        ) : null}
        </>
        )}
      </Dropzone>
      ) : null}

      {compareIds.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-input border border-ice/30 bg-ice/5 px-3 py-2 text-xs">
          <span className="text-text-hi">
            {compareIds.length === 1
              ? "Pick one more version to compare."
              : `Comparing v${
                  versions.find((v) => v.id === compareIds[0])?.version_no
                } vs v${
                  versions.find((v) => v.id === compareIds[1])?.version_no
                }`}
          </span>
          <div className="flex gap-2">
            {compareIds.length === 2 ? (
              <Button size="sm" onClick={() => setAbOpen(true)}>
                Start blind A/B
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setCompareIds([])}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      <ol className="relative mt-4">
        {isLoading ? (
          <li className="h-16 animate-pulse rounded-card bg-bg-2" />
        ) : versions.length === 0 ? (
          <li className="py-4 text-center text-sm text-text-lo">
            No versions yet. Drop a bounce above.
          </li>
        ) : (
          versions.map((v, i) => (
            <VersionRow
              key={v.id}
              version={v}
              isLast={i === versions.length - 1}
              isPlaying={playingId === v.id}
              decisions={decisionsByVersion.get(v.id) ?? []}
              historyOpen={historyFor === v.id}
              onToggleHistory={() =>
                setHistoryFor((cur) => (cur === v.id ? null : v.id))
              }
              compareSelected={compareIds.includes(v.id)}
              onToggleCompare={() => toggleCompare(v.id)}
              onPlay={() => onPlay(v.id)}
              canManage={canManage}
              uploadedBy={uploaderByVersionId.get(v.id) ?? null}
              onSetCurrent={async () => {
                try {
                  await setCurrent.mutateAsync(v.id);
                } catch (err) {
                  toast(
                    err instanceof Error
                      ? err.message
                      : "Couldn’t mark as current."
                  );
                }
              }}
              onDownload={() => void handleDownload(v)}
              onPin={() => setPinTarget(v)}
              onUnpin={() => void handleUnpin(v)}
              onDecide={() => setDecisionTarget(v)}
              onDelete={() => setDeleteTarget(v)}
            />
          ))
        )}
      </ol>

      <PinDialog
        version={pinTarget}
        onClose={() => setPinTarget(null)}
        onSave={async (input) => {
          if (!pinTarget) return;
          try {
            await pin.mutateAsync({ versionId: pinTarget.id, input });
            toast(`v${pinTarget.version_no} pinned`, "ok");
            setPinTarget(null);
          } catch (err) {
            toast(
              err instanceof Error ? err.message : "Couldn’t pin version."
            );
          }
        }}
      />


      <DecisionDialog
        trackId={trackId}
        version={decisionTarget}
        onClose={() => setDecisionTarget(null)}
      />

      <DeleteVersionDialog
        version={deleteTarget}
        decisionsCount={
          deleteTarget ? (decisionsByVersion.get(deleteTarget.id) ?? []).length : 0
        }
        activeGuestLinks={
          deleteTarget ? activeGuestLinksFor(deleteTarget.id) : []
        }
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          try {
            await remove.mutateAsync(deleteTarget);
            toast(`v${deleteTarget.version_no} deleted`, "ok");
            setDeleteTarget(null);
          } catch (err) {
            toast(
              err instanceof Error ? err.message : "Couldn’t delete version."
            );
          }
        }}
      />

      <Dialog open={abOpen} onOpenChange={setAbOpen}>
        {abOpen && compareIds.length === 2 ? (
          <DialogContent
            title="Blind A/B"
            description="Identities stay hidden until you reveal."
            onClose={() => setAbOpen(false)}
            className="max-w-xl"
          >
            <BlindAB
              trackId={trackId}
              versionAId={compareIds[0]}
              versionBId={compareIds[1]}
              onClose={() => {
                setAbOpen(false);
                setCompareIds([]);
              }}
            />
          </DialogContent>
        ) : null}
      </Dialog>
    </section>
  );
}

/**
 * Bounce location badge — planning/desktop/01-PRODUCT-AND-UX-SPEC.md
 * "Bounce history, now unbounded". On desktop: "On this computer" once
 * mirrored, "On another computer" once evicted from the cloud but confirmed
 * on some other device. On the web with no desktop app, a local_only
 * version (evicted from the cloud) can't be signed for playback, so it says
 * plainly why instead of failing silently.
 */
function VaultBadge({ version }: { version: Version }) {
  const desktop = React.useMemo(() => isDesktopApp(), []);
  const [hasLocal, setHasLocal] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    if (!desktop) return;
    let active = true;
    void vaultHas(version.file_url).then((v) => {
      if (active) setHasLocal(v);
    });
    return () => {
      active = false;
    };
  }, [desktop, version.file_url]);

  if (desktop) {
    if (hasLocal) {
      return (
        <span className="inline-flex items-center gap-1 rounded-chip border border-ok/30 bg-ok/10 px-1.5 py-0.5 font-mono text-[10px] text-ok">
          <HardDrive className="size-2.5" />
          On this computer
        </span>
      );
    }
    if (version.cloud_state === "local_only") {
      return (
        <span className="inline-flex items-center gap-1 rounded-chip border border-line bg-bg-2 px-1.5 py-0.5 font-mono text-[10px] text-text-lo">
          <MonitorSmartphone className="size-2.5" />
          On another computer
        </span>
      );
    }
    return null;
  }

  if (version.cloud_state === "local_only") {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-chip border border-line bg-bg-2 px-1.5 py-0.5 font-mono text-[10px] text-text-lo"
        title="This bounce is only on a desktop computer's local vault — open TEMPO Desktop on that device to play it."
      >
        <MonitorSmartphone className="size-2.5" />
        Desktop only
      </span>
    );
  }
  return null;
}

function VersionRow({
  version: v,
  isLast,
  isPlaying,
  decisions,
  historyOpen,
  onToggleHistory,
  compareSelected,
  onToggleCompare,
  onPlay,
  onSetCurrent,
  onDownload,
  onPin,
  onUnpin,
  onDecide,
  onDelete,
  canManage = true,
  uploadedBy,
}: {
  version: Version;
  isLast: boolean;
  isPlaying: boolean;
  decisions: VersionDecision[];
  historyOpen: boolean;
  onToggleHistory: () => void;
  compareSelected: boolean;
  onToggleCompare: () => void;
  onPlay: () => void;
  onSetCurrent: () => void;
  onDownload: () => void;
  onPin: () => void;
  onUnpin: () => void;
  onDecide: () => void;
  onDelete: () => void;
  canManage?: boolean;
  uploadedBy?: string | null;
}) {
  const { data: commentCount = 0 } = useVersionCommentCount(v.id);
  const latestDecision = decisions[0];
  const milestoneLabel =
    v.milestone_type &&
    MILESTONE_TYPES.find((m) => m.value === v.milestone_type)?.label;

  return (
    <li className="relative pl-6">
      {!isLast ? (
        <span
          aria-hidden
          className="absolute left-[7px] top-6 bottom-[-4px] w-px bg-line"
        />
      ) : null}
      <span
        aria-hidden
        className={cn(
          "absolute left-0 top-2 size-3.5 rounded-full border-2",
          v.is_current
            ? "border-amber bg-amber/25"
            : v.is_pinned
              ? "border-ice bg-ice/25"
              : "border-line bg-bg-2"
        )}
      />
      <div
        className={cn(
          "mb-2 rounded-card border border-line bg-bg-2/50 px-3 py-2.5",
          isPlaying && "ring-1 ring-ice/40"
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "font-mono text-sm",
                  v.is_current ? "text-amber" : "text-text-hi"
                )}
              >
                v{v.version_no}
              </span>
              {v.label ? (
                <span className="truncate text-sm text-text-hi">
                  {v.label}
                </span>
              ) : null}
              {v.is_current ? (
                <span className="font-mono text-[10px] uppercase tracking-wider text-amber">
                  current
                </span>
              ) : null}
              {v.is_pinned ? (
                <span className="inline-flex items-center gap-1 rounded-chip border border-ice/30 bg-ice/10 px-1.5 py-0.5 font-mono text-[10px] text-ice">
                  <Pin className="size-2.5" />
                  {milestoneLabel || "Milestone"}
                </span>
              ) : null}
              <VaultBadge version={v} />
            </div>
            {v.milestone_label ? (
              <p className="mt-0.5 text-xs text-ice/80">
                “{v.milestone_label}”
              </p>
            ) : null}
            {v.changelog ? (
              <p className="mt-0.5 text-xs text-text-lo">{v.changelog}</p>
            ) : null}
            <p className="mt-1 flex flex-wrap items-center gap-x-1.5 font-mono text-[11px] text-text-lo">
              <span>{formatShortDate(v.created_at)}</span>
              <span>·</span>
              <span>{formatFileSize(v.file_size)}</span>
              {uploadedBy ? (
                <>
                  <span>·</span>
                  <span>{uploadedBy}</span>
                </>
              ) : null}
              {commentCount > 0 ? (
                <>
                  <span>·</span>
                  <span>
                    {commentCount} comment{commentCount === 1 ? "" : "s"}
                  </span>
                </>
              ) : null}
            </p>
            {latestDecision ? (
              <button
                type="button"
                onClick={onToggleHistory}
                className="mt-1.5 flex items-center gap-1 text-xs"
              >
                <DecisionChip decision={latestDecision} />
                {decisions.length > 1 ? (
                  <span className="flex items-center gap-0.5 text-text-lo hover:text-text-hi">
                    +{decisions.length - 1} more
                    <ChevronDown
                      className={cn(
                        "size-3 transition-transform duration-hover",
                        historyOpen && "rotate-180"
                      )}
                    />
                  </span>
                ) : null}
              </button>
            ) : null}
            {historyOpen && decisions.length > 1 ? (
              <ul className="mt-1.5 space-y-1 border-l border-line pl-2">
                {decisions.slice(1).map((d) => (
                  <li key={d.id} className="text-xs">
                    <DecisionChip decision={d} showDate />
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <label
              className="mr-1 flex items-center gap-1 text-[10px] text-text-lo"
              title="Select for blind A/B"
            >
              <input
                type="checkbox"
                checked={compareSelected}
                onChange={onToggleCompare}
                className="size-3.5 accent-[var(--ice)]"
                aria-label={`Compare v${v.version_no} in blind A/B`}
              />
              Compare
            </label>
            <IconBtn label="Play" onClick={onPlay}>
              <Play className="size-3.5" />
            </IconBtn>
            {!v.is_current && canManage ? (
              <button
                type="button"
                className="rounded-input px-2 py-1 text-[11px] text-ice hover:bg-ice/10"
                onClick={onSetCurrent}
              >
                Set current
              </button>
            ) : null}
            <IconBtn label="Download" onClick={onDownload}>
              <Download className="size-3.5" />
            </IconBtn>
            {canManage ? (
              v.is_pinned ? (
                <IconBtn label="Unpin" onClick={onUnpin}>
                  <PinOff className="size-3.5" />
                </IconBtn>
              ) : (
                <IconBtn label="Pin as milestone" onClick={onPin}>
                  <Pin className="size-3.5" />
                </IconBtn>
              )
            ) : null}
            {canManage ? (
              <button
                type="button"
                className="rounded-input px-2 py-1 text-[11px] text-text-lo hover:bg-bg-1 hover:text-ice"
                onClick={onDecide}
              >
                Decide
              </button>
            ) : null}
            {canManage ? (
              <IconBtn label="Delete" onClick={onDelete} danger>
                <Trash2 className="size-3.5" />
              </IconBtn>
            ) : null}
          </div>
        </div>
      </div>
    </li>
  );
}

function DecisionChip({
  decision,
  showDate,
}: {
  decision: VersionDecision;
  showDate?: boolean;
}) {
  const tone = DECISION_TONE[decision.decision_type];
  const Icon = tone.icon;
  const areaLabel =
    DECISION_AREAS.find((a) => a.value === decision.decision_area)?.label ??
    decision.decision_area;
  return (
    <span className={cn("inline-flex items-center gap-1", tone.className)}>
      <Icon className="size-3 shrink-0" />
      <span className="font-medium">
        {DECISION_TYPES.find((d) => d.value === decision.decision_type)
          ?.label ?? decision.decision_type}
      </span>
      <span className="text-text-lo">· {areaLabel}</span>
      {decision.note ? (
        <span className="truncate text-text-lo">— {decision.note}</span>
      ) : null}
      {showDate ? (
        <span className="font-mono text-[10px] text-text-lo">
          {formatShortDate(decision.created_at)}
        </span>
      ) : null}
    </span>
  );
}

function IconBtn({
  children,
  label,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        "rounded-input p-1.5 text-text-lo transition-colors duration-hover hover:bg-bg-1",
        danger ? "hover:text-warn" : "hover:text-ice"
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function PinDialog({
  version,
  onClose,
  onSave,
}: {
  version: Version | null;
  onClose: () => void;
  onSave: (input: {
    milestoneType?: MilestoneType | null;
    milestoneLabel?: string | null;
  }) => Promise<void>;
}) {
  const [type, setType] = React.useState<MilestoneType | "">("");
  const [label, setLabel] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (version) {
      setType(version.milestone_type ?? "");
      setLabel(version.milestone_label ?? "");
    }
  }, [version]);

  return (
    <Dialog open={!!version} onOpenChange={(o) => !o && onClose()}>
      {version ? (
        <DialogContent
          title={`Pin v${version.version_no} as a milestone`}
          description="Pinned versions are exempt from the two-bounce cleanup rule."
          onClose={onClose}
        >
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await onSave({
                  milestoneType: type || null,
                  milestoneLabel: label || null,
                });
              } finally {
                setBusy(false);
              }
            }}
          >
            <div>
              <Label htmlFor="milestone-type">Milestone type</Label>
              <select
                id="milestone-type"
                value={type}
                onChange={(e) => setType(e.target.value as MilestoneType | "")}
                className="flex h-9 w-full rounded-input border border-line bg-bg-2 px-3 text-sm text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
              >
                <option value="">Just pin it (no specific type)</option>
                {MILESTONE_TYPES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="milestone-label">Label (optional)</Label>
              <Input
                id="milestone-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Vocal comp before re-record"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Pinning…" : "Pin version"}
              </Button>
            </div>
          </form>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

function DecisionDialog({
  trackId,
  version,
  onClose,
}: {
  trackId: string;
  version: Version | null;
  onClose: () => void;
}) {
  const { create } = useDecisionMutations(trackId);
  const { data: allDecisions = [] } = useDecisions(trackId);
  const { toast } = useToast();
  const [type, setType] = React.useState<DecisionType>("approved");
  const [area, setArea] = React.useState<DecisionArea>("general");
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (version) {
      setType("approved");
      setArea("general");
      setNote("");
    }
  }, [version]);

  const log = version
    ? allDecisions.filter((d) => d.version_id === version.id)
    : [];

  return (
    <Dialog open={!!version} onOpenChange={(o) => !o && onClose()}>
      {version ? (
        <DialogContent
          title={`Record a decision — v${version.version_no}`}
          description="Decisions are append-only — this adds to the log, it doesn’t overwrite past calls."
          onClose={onClose}
        >
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await create.mutateAsync({
                  versionId: version.id,
                  decisionType: type,
                  decisionArea: area,
                  note: note || null,
                });
                toast("Decision recorded", "ok");
                onClose();
              } catch (err) {
                toast(
                  err instanceof Error
                    ? err.message
                    : "Couldn’t save that decision."
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <div>
              <Label htmlFor="decision-type">Decision</Label>
              <div className="flex flex-wrap gap-2">
                {DECISION_TYPES.map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => setType(d.value)}
                    className={cn(
                      "rounded-chip border px-3 py-1.5 text-xs transition-colors duration-hover",
                      type === d.value
                        ? "border-ice/50 bg-ice/15 text-ice"
                        : "border-line bg-bg-2 text-text-lo hover:text-text-hi"
                    )}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="decision-area">Area</Label>
              <select
                id="decision-area"
                value={area}
                onChange={(e) => setArea(e.target.value as DecisionArea)}
                className="flex h-9 w-full rounded-input border border-line bg-bg-2 px-3 text-sm text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
              >
                {DECISION_AREAS.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="decision-note">Note (optional)</Label>
              <Textarea
                id="decision-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="Vocal still needs comping in the bridge…"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Saving…" : "Save decision"}
              </Button>
            </div>
          </form>

          {log.length > 0 ? (
            <div className="mt-4 border-t border-line pt-3">
              <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.08em] text-text-lo">
                Decision log for v{version.version_no}
              </p>
              <ul className="space-y-1.5">
                {log.map((d) => (
                  <li key={d.id} className="text-xs">
                    <DecisionChip decision={d} showDate />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

function DeleteVersionDialog({
  version,
  decisionsCount,
  activeGuestLinks,
  onClose,
  onConfirm,
}: {
  version: Version | null;
  decisionsCount: number;
  activeGuestLinks: GuestReviewLink[];
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const { data: commentCount = 0 } = useVersionCommentCount(
    version?.id ?? null
  );
  const [busy, setBusy] = React.useState(false);
  const blocked = activeGuestLinks.length > 0;

  return (
    <Dialog open={!!version} onOpenChange={(o) => !o && onClose()}>
      {version ? (
        <DialogContent
          title={`Delete v${version.version_no}?`}
          onClose={onClose}
        >
          {blocked ? (
            <div className="space-y-3">
              <p className="text-sm text-warn">
                Can’t delete this version — {activeGuestLinks.length} active
                guest link{activeGuestLinks.length === 1 ? "" : "s"} still
                point{activeGuestLinks.length === 1 ? "s" : ""} at it. Revoke
                the guest link{activeGuestLinks.length === 1 ? "" : "s"} first,
                then delete.
              </p>
              <div className="flex justify-end">
                <Button type="button" variant="secondary" onClick={onClose}>
                  Close
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <ul className="list-disc space-y-1 pl-4 text-sm text-text-lo">
                {version.is_pinned ? (
                  <li>
                    This version is pinned as a milestone — the pin goes away
                    too.
                  </li>
                ) : null}
                {commentCount > 0 ? (
                  <li>
                    {commentCount} comment{commentCount === 1 ? "" : "s"} on
                    this version will be deleted.
                  </li>
                ) : null}
                {decisionsCount > 0 ? (
                  <li>
                    {decisionsCount} recorded decision
                    {decisionsCount === 1 ? "" : "s"} for this version will be
                    deleted.
                  </li>
                ) : null}
                <li>The audio file is removed from storage for good.</li>
              </ul>
              <p className="text-sm text-warn">This can’t be undone.</p>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await onConfirm();
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {busy ? "Deleting…" : "Delete forever"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
