"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { SignedImage } from "@/components/ui/signed-image";
import { VersionPlayer } from "@/components/track/version-player";
import { useChecklist, useChecklistMutations } from "@/hooks/use-checklist";
import { useActiveSession, useSessionMutations } from "@/hooks/use-sessions";
import { useReferences } from "@/hooks/use-references";
import { useTrack, useTrackMutations } from "@/hooks/use-tracks";
import { useVersionMutations, useVersions } from "@/hooks/use-versions";
import { AUDIO_ACCEPT } from "@/lib/constants";
import {
  FOCUS_CHECKLIST_KEY,
  FOCUS_REFERENCES_KEY,
  readSessionIdArray,
} from "@/lib/focus-storage";
import { formatDuration } from "@/lib/format";
import { gradientFromTrackId } from "@/lib/track-style";
import { cn } from "@/lib/utils";

export default function FocusSessionPage() {
  const params = useParams<{ id: string }>();
  const trackId = params.id;
  const router = useRouter();
  const { toast } = useToast();

  const trackQuery = useTrack(trackId);
  const activeSessionQuery = useActiveSession();
  const { data: items = [] } = useChecklist(trackId);
  const { update: updateChecklistItem } = useChecklistMutations(trackId);
  const { data: versions = [] } = useVersions(trackId);
  const { data: references = [] } = useReferences(trackId);
  const { abandonFocus } = useSessionMutations(trackId);

  const [scratch, setScratch] = React.useState("");
  const [scratchDirty, setScratchDirty] = React.useState(false);
  const [endOpen, setEndOpen] = React.useState(false);
  const [abandonOpen, setAbandonOpen] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0);
  const [focusItemIds, setFocusItemIds] = React.useState<string[] | null>(null);
  const [focusRefIds, setFocusRefIds] = React.useState<string[]>([]);

  const track = trackQuery.data;
  const session = activeSessionQuery.data;
  const sessionBelongsHere = session && session.track_id === trackId;

  const [playerVersionId, setPlayerVersionId] = React.useState<string | null>(
    null
  );

  React.useEffect(() => {
    setFocusItemIds(readSessionIdArray(FOCUS_CHECKLIST_KEY(trackId)));
    setFocusRefIds(readSessionIdArray(FOCUS_REFERENCES_KEY(trackId)));
  }, [trackId]);

  React.useEffect(() => {
    if (session?.version_id) setPlayerVersionId(session.version_id);
  }, [session?.version_id]);

  React.useEffect(() => {
    if (!session?.started_at || !sessionBelongsHere) return;
    const start = new Date(session.started_at).getTime();
    const tick = () =>
      setElapsed(Math.max(0, Math.round((Date.now() - start) / 1000)));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [session?.started_at, sessionBelongsHere]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    function handler(e: BeforeUnloadEvent) {
      if (!scratchDirty) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [scratchDirty]);

  function confirmLeave(): boolean {
    if (!scratchDirty) return true;
    return window.confirm(
      "Your scratch notes aren't saved anywhere else — leave anyway?"
    );
  }

  const visibleItems =
    focusItemIds && focusItemIds.length > 0
      ? items.filter((i) => focusItemIds.includes(i.id))
      : items.filter((i) => !i.done);

  const visibleReferences = references.filter((r) => focusRefIds.includes(r.id));

  if (trackQuery.isLoading || activeSessionQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-text-lo">Loading focus session…</p>
      </div>
    );
  }

  if (!track) {
    return (
      <FocusEmptyState
        title="Couldn’t find that track"
        actionHref="/board"
        actionLabel="Back to board"
      />
    );
  }

  if (!sessionBelongsHere) {
    return (
      <FocusEmptyState
        title={
          session
            ? "Your active focus session is on a different track."
            : "No focus session running for this track."
        }
        actionHref={session ? `/track/${session.track_id}/focus` : `/track/${trackId}`}
        actionLabel={session ? "Go to that session" : "Back to track"}
      />
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 py-6 sm:px-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            if (confirmLeave()) router.push(`/track/${trackId}`);
          }}
          className="flex items-center gap-1.5 text-sm text-text-lo transition-colors duration-hover hover:text-ice"
        >
          <ArrowLeft className="size-4" />
          Exit focus
        </button>
        <button
          type="button"
          onClick={() => setAbandonOpen(true)}
          className="flex items-center gap-1 text-xs text-text-lo transition-colors duration-hover hover:text-warn"
        >
          <X className="size-3.5" />
          Abandon
        </button>
      </div>

      <div className="mb-6 flex items-center gap-3">
        <div
          className="relative size-12 shrink-0 overflow-hidden rounded-input border border-line"
          style={{ background: gradientFromTrackId(track.id) }}
        >
          <SignedImage path={track.artwork_url} className="absolute inset-0 size-full" />
        </div>
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-semibold tracking-tight text-text-hi">
            {track.title}
          </p>
          {session.goal ? (
            <p className="truncate text-sm text-text-lo">{session.goal}</p>
          ) : (
            <p className="text-sm text-text-lo">Focus session</p>
          )}
        </div>
      </div>

      <div className="mb-6 rounded-card border border-ice/30 bg-ice/5 px-5 py-4 text-center">
        <p className="font-mono text-3xl tabular-nums text-ice">
          {formatDuration(elapsed)}
        </p>
        <p className="mt-1 text-xs text-text-lo">elapsed this session</p>
      </div>

      <div className="mb-6">
        <VersionPlayer
          trackId={trackId}
          trackTitle={track.title}
          versions={versions}
          selectedId={playerVersionId}
          onSelect={setPlayerVersionId}
          spotifyTrackId={track.spotify_track_id}
          spotifyUrl={track.spotify_url}
        />
      </div>

      {visibleItems.length > 0 ? (
        <section className="mb-6 rounded-card border border-line bg-bg-1 p-4">
          <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.08em] text-text-lo">
            {focusItemIds && focusItemIds.length > 0
              ? "Checklist for this session"
              : "Open checklist items"}
          </h2>
          <ul className="space-y-1.5">
            {visibleItems.map((item) => (
              <li key={item.id}>
                <label className="flex items-center gap-2 rounded-input px-1.5 py-1 text-sm text-text-hi hover:bg-bg-2/50">
                  <input
                    type="checkbox"
                    className="size-3.5 accent-[var(--ice)]"
                    checked={item.done}
                    onChange={() =>
                      updateChecklistItem.mutate({
                        id: item.id,
                        patch: { done: !item.done },
                      })
                    }
                  />
                  <span className={cn(item.done && "text-text-lo line-through")}>
                    {item.text}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {visibleReferences.length > 0 ? (
        <section className="mb-6 rounded-card border border-line bg-bg-1 p-4">
          <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.08em] text-text-lo">
            References for this session
          </h2>
          <ul className="space-y-2">
            {visibleReferences.map((ref) => (
              <li key={ref.id} className="rounded-input border border-line bg-bg-2/50 px-3 py-2">
                <p className="text-sm text-text-hi">{ref.title}</p>
                {ref.intent ? (
                  <p className="mt-0.5 text-xs text-ice/80">{ref.intent}</p>
                ) : null}
                {ref.note ? <p className="mt-0.5 text-xs text-text-lo">{ref.note}</p> : null}
                {ref.kind === "link" && ref.url ? (
                  <a
                    href={ref.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-0.5 inline-flex items-center gap-1 text-xs text-ice hover:underline"
                  >
                    <ExternalLink className="size-3" />
                    {ref.url}
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mb-6 flex-1 rounded-card border border-line bg-bg-1 p-4">
        <h2 className="mb-2 font-mono text-xs uppercase tracking-[0.08em] text-text-lo">
          Scratch notes
        </h2>
        <Textarea
          value={scratch}
          onChange={(e) => {
            setScratch(e.target.value);
            setScratchDirty(e.target.value.trim().length > 0);
          }}
          placeholder="Jot anything down — this is just for you during the session."
          rows={6}
        />
        <p className="mt-1.5 text-xs text-text-lo">
          Not saved anywhere — carry anything important into the end summary.
        </p>
      </section>

      <Button type="button" size="lg" onClick={() => setEndOpen(true)}>
        End session
      </Button>

      <EndFocusDialog
        open={endOpen}
        onOpenChange={setEndOpen}
        trackId={trackId}
        sessionId={session.id}
        scratch={scratch}
        checklistItems={visibleItems}
        onDone={() => {
          setScratchDirty(false);
          router.push(`/track/${trackId}`);
        }}
      />

      <Dialog open={abandonOpen} onOpenChange={setAbandonOpen}>
        <DialogContent
          title="Abandon this session?"
          description="It won't be logged as a completed session — just the time is discarded."
          onClose={() => setAbandonOpen(false)}
        >
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setAbandonOpen(false)}>
              Keep going
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={async () => {
                try {
                  await abandonFocus.mutateAsync(session.id);
                  window.sessionStorage.removeItem(FOCUS_CHECKLIST_KEY(trackId));
                  setScratchDirty(false);
                  router.push(`/track/${trackId}`);
                } catch (err) {
                  toast(
                    err instanceof Error
                      ? err.message
                      : "Couldn’t abandon that session."
                  );
                }
              }}
            >
              Abandon
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FocusEmptyState({
  title,
  actionHref,
  actionLabel,
}: {
  title: string;
  actionHref: string;
  actionLabel: string;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-sm text-text-lo">{title}</p>
      <Link href={actionHref} className="text-sm text-ice hover:underline">
        {actionLabel}
      </Link>
    </div>
  );
}

function EndFocusDialog({
  open,
  onOpenChange,
  trackId,
  sessionId,
  scratch,
  checklistItems,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trackId: string;
  sessionId: string;
  scratch: string;
  checklistItems: { id: string; text: string; done: boolean }[];
  onDone: () => void;
}) {
  const { toast } = useToast();
  const trackQuery = useTrack(trackId);
  const track = trackQuery.data;
  const { endFocus } = useSessionMutations(trackId);
  const { update: updateChecklistItem } = useChecklistMutations(trackId);
  const { update: updateTrack } = useTrackMutations(track?.space_id ?? null);
  const { upload } = useVersionMutations(trackId);

  const [whatChanged, setWhatChanged] = React.useState("");
  const [whatsLeft, setWhatsLeft] = React.useState("");
  const [nextMove, setNextMove] = React.useState("");
  const [applyNextMove, setApplyNextMove] = React.useState(true);
  const [markedDone, setMarkedDone] = React.useState<Set<string>>(new Set());
  const [bounceFile, setBounceFile] = React.useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = React.useState<number | null>(null);
  const [busy, setBusy] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) {
      setWhatChanged(scratch.trim());
      setWhatsLeft("");
      setNextMove("");
      setApplyNextMove(true);
      setMarkedDone(new Set());
      setBounceFile(null);
    }
  }, [open, scratch]);

  function toggleDone(id: string) {
    setMarkedDone((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!whatChanged.trim()) {
      toast("Add a line on what changed this session.");
      return;
    }
    setBusy(true);
    try {
      let versionId: string | null = null;
      if (bounceFile) {
        setUploadProgress(0);
        const version = await upload.mutateAsync({
          file: bounceFile,
          changelog: whatChanged.trim(),
          onProgress: setUploadProgress,
        });
        versionId = version.id;
      }

      await endFocus.mutateAsync({
        sessionId,
        input: {
          note: whatChanged,
          outcome: whatsLeft || null,
          nextActionAfter: nextMove || null,
          versionId,
        },
      });

      for (const id of Array.from(markedDone)) {
        await updateChecklistItem.mutateAsync({ id, patch: { done: true } });
      }

      if (applyNextMove && nextMove.trim() && track) {
        await updateTrack.mutateAsync({
          id: track.id,
          patch: { next_action: nextMove.trim() },
        });
      }

      window.sessionStorage.removeItem(FOCUS_CHECKLIST_KEY(trackId));
      toast("Session logged", "ok");
      onDone();
    } catch (err) {
      setUploadProgress(null);
      toast(
        err instanceof Error ? err.message : "Couldn’t save that session."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Wrap up this session"
        onClose={() => onOpenChange(false)}
        className="max-w-lg"
      >
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <Label htmlFor="what-changed">What changed?</Label>
            <Textarea
              id="what-changed"
              value={whatChanged}
              onChange={(e) => setWhatChanged(e.target.value)}
              rows={3}
              placeholder="Comped the lead vocal, rewrote the bridge…"
              required
            />
          </div>
          <div>
            <Label htmlFor="whats-left">What&apos;s left (optional)</Label>
            <Textarea
              id="whats-left"
              value={whatsLeft}
              onChange={(e) => setWhatsLeft(e.target.value)}
              rows={2}
              placeholder="Still needs a pass on the outro…"
            />
          </div>
          <div>
            <Label htmlFor="next-move">Next move (optional)</Label>
            <Input
              id="next-move"
              value={nextMove}
              onChange={(e) => setNextMove(e.target.value)}
              placeholder="e.g. Send to Sam for a mix check"
            />
            {nextMove.trim() ? (
              <label className="mt-1.5 flex items-center gap-2 text-xs text-text-lo">
                <input
                  type="checkbox"
                  className="size-3.5 accent-[var(--ice)]"
                  checked={applyNextMove}
                  onChange={(e) => setApplyNextMove(e.target.checked)}
                />
                Also set this as the track&apos;s next move
              </label>
            ) : null}
          </div>

          {checklistItems.length > 0 ? (
            <div>
              <Label>Mark items done (optional)</Label>
              <ul className="mt-1 max-h-32 space-y-1 overflow-y-auto rounded-input border border-line bg-bg-2/50 p-2">
                {checklistItems
                  .filter((i) => !i.done)
                  .map((item) => (
                    <li key={item.id}>
                      <label className="flex items-center gap-2 rounded-input px-1.5 py-1 text-sm text-text-hi hover:bg-bg-1">
                        <input
                          type="checkbox"
                          className="size-3.5 accent-[var(--ice)]"
                          checked={markedDone.has(item.id)}
                          onChange={() => toggleDone(item.id)}
                        />
                        {item.text}
                      </label>
                    </li>
                  ))}
              </ul>
            </div>
          ) : null}

          <div>
            <Label>Bounce a new version (optional)</Label>
            <div className="mt-1 flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => inputRef.current?.click()}
                disabled={uploadProgress != null}
              >
                <Upload className="size-3.5" />
                {bounceFile ? bounceFile.name : "Choose file"}
              </Button>
              {bounceFile ? (
                <button
                  type="button"
                  className="text-xs text-text-lo hover:text-warn"
                  onClick={() => setBounceFile(null)}
                >
                  Remove
                </button>
              ) : null}
              <input
                ref={inputRef}
                type="file"
                accept={AUDIO_ACCEPT}
                className="hidden"
                onChange={(e) => setBounceFile(e.target.files?.[0] ?? null)}
              />
            </div>
            {uploadProgress != null ? (
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-bg-0">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-ice to-amber transition-all duration-hover"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            ) : null}
          </div>

          <div className="flex justify-end gap-2 border-t border-line pt-3">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save & end session"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
