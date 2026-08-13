"use client";

import * as React from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ExternalLink,
  FileAudio,
  GripVertical,
  Image as ImageIcon,
  Link2,
  Pause,
  Play,
  Plus,
  Star,
  StickyNote,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SignedImage } from "@/components/ui/signed-image";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { useAssets } from "@/hooks/use-assets";
import { useReferenceMutations, useReferences } from "@/hooks/use-references";
import { playbackCoordinator } from "@/lib/playback-coordinator";
import { REFERENCE_KINDS } from "@/lib/constants";
import { formatDuration } from "@/lib/format";
import { FOCUS_REFERENCES_KEY, readSessionIdArray } from "@/lib/focus-storage";
import { getSignedUrl } from "@/lib/storage";
import type { Asset, ReferenceKind, TrackReference } from "@/lib/types";
import { cn } from "@/lib/utils";

type ReferencesPanelProps = {
  trackId: string;
};

const KIND_ICON: Record<ReferenceKind, React.ComponentType<{ className?: string }>> = {
  audio: FileAudio,
  image: ImageIcon,
  link: Link2,
  note: StickyNote,
};

function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Reference material for a track — other tracks, sounds, images, links, or
 * plain notes with an intent ("why this matters"). Audio references can carry
 * a start/end clip and play through the shared playback coordinator so they
 * never overlap the main player (FEATURE-SPECS §11).
 */
export function ReferencesPanel({ trackId }: ReferencesPanelProps) {
  const { data: references = [], isLoading } = useReferences(trackId);
  const { data: assets = [] } = useAssets(trackId);
  const { create, update, remove, reorder } = useReferenceMutations(trackId);
  const { toast } = useToast();

  const [addOpen, setAddOpen] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState<TrackReference | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<TrackReference | null>(null);
  const [focusIds, setFocusIds] = React.useState<Set<string>>(() => new Set());

  React.useEffect(() => {
    setFocusIds(new Set(readSessionIdArray(FOCUS_REFERENCES_KEY(trackId))));
  }, [trackId]);

  function toggleFocus(id: string) {
    setFocusIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(
          FOCUS_REFERENCES_KEY(trackId),
          JSON.stringify(Array.from(next))
        );
      }
      return next;
    });
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = references.findIndex((r) => r.id === active.id);
    const newIndex = references.findIndex((r) => r.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(references, oldIndex, newIndex).map((r, i) => ({
      id: r.id,
      sort: i,
    }));
    reorder.mutate(next);
  }

  return (
    <section className="rounded-card border border-line bg-bg-1 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-mono text-xs uppercase tracking-[0.08em] text-text-lo">
          References
        </h2>
        <Button type="button" size="sm" variant="secondary" onClick={() => setAddOpen(true)}>
          <Plus className="size-3.5" />
          Add
        </Button>
      </div>

      {references.length > 0 ? (
        <p className="mb-2 text-xs text-text-lo">
          Star a reference to bring it into your next focus session.
        </p>
      ) : null}

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-input bg-bg-2" />
          ))}
        </div>
      ) : references.length === 0 ? (
        <p className="py-3 text-center text-sm text-text-lo">
          No references yet — sounds, images, links, or notes that inform this track.
        </p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={references.map((r) => r.id)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-2">
              {references.map((ref) => (
                <SortableReferenceRow
                  key={ref.id}
                  reference={ref}
                  asset={assets.find((a) => a.id === ref.asset_id) ?? null}
                  onEdit={() => setEditTarget(ref)}
                  onDelete={() => setDeleteTarget(ref)}
                  inFocus={focusIds.has(ref.id)}
                  onToggleFocus={() => toggleFocus(ref.id)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      <ReferenceFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        assets={assets}
        onSave={async (input) => {
          try {
            await create.mutateAsync(input);
            toast("Reference added", "ok");
            setAddOpen(false);
          } catch (err) {
            toast(err instanceof Error ? err.message : "Couldn’t add that reference.");
          }
        }}
      />

      <ReferenceFormDialog
        open={!!editTarget}
        onOpenChange={(o) => !o && setEditTarget(null)}
        assets={assets}
        initial={editTarget}
        onSave={async (input) => {
          if (!editTarget) return;
          try {
            await update.mutateAsync({
              id: editTarget.id,
              patch: {
                title: input.title,
                url: input.url ?? null,
                note: input.note ?? null,
                startSec: input.startSec ?? null,
                endSec: input.endSec ?? null,
                intent: input.intent ?? null,
              },
            });
            toast("Reference updated", "ok");
            setEditTarget(null);
          } catch (err) {
            toast(err instanceof Error ? err.message : "Couldn’t update that reference.");
          }
        }}
      />

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        {deleteTarget ? (
          <DialogContent title={`Remove "${deleteTarget.title}"?`} onClose={() => setDeleteTarget(null)}>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={async () => {
                  try {
                    await remove.mutateAsync(deleteTarget.id);
                    setDeleteTarget(null);
                  } catch (err) {
                    toast(err instanceof Error ? err.message : "Couldn’t remove that reference.");
                  }
                }}
              >
                Remove
              </Button>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </section>
  );
}

function SortableReferenceRow({
  reference: ref,
  asset,
  onEdit,
  onDelete,
  inFocus,
  onToggleFocus,
}: {
  reference: TrackReference;
  asset: Asset | null;
  onEdit: () => void;
  onDelete: () => void;
  inFocus: boolean;
  onToggleFocus: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: ref.id });
  const Icon = KIND_ICON[ref.kind];
  const audioRef = React.useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = React.useState(false);
  const [src, setSrc] = React.useState<string | null>(null);
  const playbackId = `reference:${ref.id}`;

  const audioSrcPath = ref.kind === "audio" ? asset?.file_url ?? ref.url ?? null : null;

  React.useEffect(() => {
    return playbackCoordinator.register(playbackId, () => {
      audioRef.current?.pause();
      setPlaying(false);
    });
  }, [playbackId]);

  function handlePlayPause() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      playbackCoordinator.notifyStop(playbackId);
      return;
    }
    playbackCoordinator.notifyPlay(playbackId);
    if (!src && audioSrcPath) {
      getSignedUrl(audioSrcPath).then((url) => {
        setSrc(url);
        requestAnimationFrame(() => {
          if (audioRef.current) {
            audioRef.current.currentTime = ref.start_sec ?? 0;
            void audioRef.current.play();
          }
        });
      });
      return;
    }
    if (audio.currentTime < (ref.start_sec ?? 0) || (ref.end_sec != null && audio.currentTime >= ref.end_sec)) {
      audio.currentTime = ref.start_sec ?? 0;
    }
    void audio.play();
    setPlaying(true);
  }

  const imagePath = ref.kind === "image" ? asset?.file_url ?? ref.url ?? null : null;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-start gap-2 rounded-input border border-line bg-bg-2/50 px-2.5 py-2",
        isDragging && "z-10 border-ice/40 bg-bg-2 shadow-raise"
      )}
    >
      <button
        type="button"
        className="mt-1 shrink-0 cursor-grab touch-none p-0.5 text-text-lo/50 hover:text-text-lo active:cursor-grabbing"
        aria-label="Reorder"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-3.5" />
      </button>

      {imagePath ? (
        <SignedImage
          path={imagePath}
          alt={ref.title}
          className="size-10 shrink-0 rounded-input border border-line"
          fallback={
            <div className="flex size-10 shrink-0 items-center justify-center rounded-input border border-line bg-bg-1">
              <Icon className="size-4 text-text-lo" />
            </div>
          }
        />
      ) : (
        <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center text-text-lo">
          <Icon className="size-4" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={onEdit}
            className="truncate text-sm font-medium text-text-hi hover:text-ice"
          >
            {ref.title}
          </button>
          {ref.kind === "audio" && (ref.start_sec != null || ref.end_sec != null) ? (
            <span className="font-mono text-[11px] text-text-lo">
              {formatDuration(ref.start_sec ?? 0)}
              {ref.end_sec != null ? `–${formatDuration(ref.end_sec)}` : ""}
            </span>
          ) : null}
        </div>
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
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          aria-label={inFocus ? "Remove from focus session" : "Bring to focus session"}
          aria-pressed={inFocus}
          onClick={onToggleFocus}
          className={cn(
            "rounded-input p-1.5 transition-colors duration-hover hover:bg-bg-1",
            inFocus ? "text-amber" : "text-text-lo/50 hover:text-text-lo"
          )}
        >
          <Star className={cn("size-3.5", inFocus && "fill-amber")} />
        </button>
        {ref.kind === "audio" && audioSrcPath ? (
          <>
            <button
              type="button"
              aria-label={playing ? "Pause" : "Play"}
              onClick={handlePlayPause}
              className="rounded-input p-1.5 text-text-lo transition-colors duration-hover hover:bg-bg-1 hover:text-ice"
            >
              {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
            </button>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <audio
              ref={audioRef}
              src={src ?? undefined}
              onEnded={() => {
                setPlaying(false);
                playbackCoordinator.notifyStop(playbackId);
              }}
              onTimeUpdate={(e) => {
                if (ref.end_sec != null && e.currentTarget.currentTime >= ref.end_sec) {
                  e.currentTarget.pause();
                  setPlaying(false);
                  playbackCoordinator.notifyStop(playbackId);
                }
              }}
              className="hidden"
            />
          </>
        ) : null}
        <button
          type="button"
          aria-label="Remove reference"
          onClick={onDelete}
          className="rounded-input p-1.5 text-text-lo transition-colors duration-hover hover:bg-bg-1 hover:text-warn"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </li>
  );
}

type ReferenceFormValues = {
  kind: ReferenceKind;
  title: string;
  url?: string | null;
  assetId?: string | null;
  note?: string | null;
  startSec?: number | null;
  endSec?: number | null;
  intent?: string | null;
};

function ReferenceFormDialog({
  open,
  onOpenChange,
  assets,
  initial,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assets: Asset[];
  initial?: TrackReference | null;
  onSave: (input: ReferenceFormValues) => Promise<void>;
}) {
  const [kind, setKind] = React.useState<ReferenceKind>("link");
  const [title, setTitle] = React.useState("");
  const [source, setSource] = React.useState<"url" | "asset">("url");
  const [url, setUrl] = React.useState("");
  const [assetId, setAssetId] = React.useState("");
  const [note, setNote] = React.useState("");
  const [intent, setIntent] = React.useState("");
  const [startSec, setStartSec] = React.useState("");
  const [endSec, setEndSec] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setKind(initial?.kind ?? "link");
    setTitle(initial?.title ?? "");
    setSource(initial?.asset_id ? "asset" : "url");
    setUrl(initial?.url ?? "");
    setAssetId(initial?.asset_id ?? "");
    setNote(initial?.note ?? "");
    setIntent(initial?.intent ?? "");
    setStartSec(initial?.start_sec != null ? String(initial.start_sec) : "");
    setEndSec(initial?.end_sec != null ? String(initial.end_sec) : "");
    setError(null);
  }, [open, initial]);

  const relevantAssets =
    kind === "audio"
      ? assets
      : kind === "image"
        ? assets.filter((a) => a.kind === "artwork" || a.kind === "other" || a.kind === "reference")
        : [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError("Give it a title.");
      return;
    }
    if ((kind === "audio" || kind === "image") && source === "url" && url.trim() && !isValidHttpUrl(url.trim())) {
      setError("That link needs to start with http:// or https://");
      return;
    }
    if (kind === "link") {
      if (!isValidHttpUrl(url.trim())) {
        setError("Links need a valid http:// or https:// URL.");
        return;
      }
    }
    setBusy(true);
    try {
      await onSave({
        kind,
        title: title.trim(),
        url: kind === "note" ? null : source === "url" ? url.trim() || null : null,
        assetId: kind !== "note" && source === "asset" ? assetId || null : null,
        note: note.trim() || null,
        intent: intent.trim() || null,
        startSec:
          kind === "audio" && startSec.trim() !== "" ? Number(startSec) : null,
        endSec: kind === "audio" && endSec.trim() !== "" ? Number(endSec) : null,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={initial ? "Edit reference" : "Add a reference"}
        onClose={() => onOpenChange(false)}
      >
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="flex flex-wrap gap-1.5">
            {REFERENCE_KINDS.map((k) => (
              <button
                key={k.value}
                type="button"
                onClick={() => setKind(k.value)}
                disabled={!!initial}
                className={cn(
                  "rounded-chip border px-3 py-1.5 text-xs transition-colors duration-hover disabled:cursor-not-allowed disabled:opacity-60",
                  kind === k.value
                    ? "border-ice/50 bg-ice/15 text-ice"
                    : "border-line bg-bg-2 text-text-lo hover:text-text-hi"
                )}
              >
                {k.label}
              </button>
            ))}
          </div>

          <div>
            <Label htmlFor="ref-title">Title</Label>
            <Input
              id="ref-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Reference mix — similar energy"
              autoFocus
            />
          </div>

          {kind === "audio" || kind === "image" ? (
            <div>
              <div className="mb-1.5 flex gap-1">
                <button
                  type="button"
                  onClick={() => setSource("url")}
                  className={cn(
                    "rounded-chip border px-2.5 py-1 text-xs",
                    source === "url"
                      ? "border-ice/50 bg-ice/15 text-ice"
                      : "border-line bg-bg-2 text-text-lo"
                  )}
                >
                  External link
                </button>
                <button
                  type="button"
                  onClick={() => setSource("asset")}
                  disabled={relevantAssets.length === 0}
                  className={cn(
                    "rounded-chip border px-2.5 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50",
                    source === "asset"
                      ? "border-ice/50 bg-ice/15 text-ice"
                      : "border-line bg-bg-2 text-text-lo"
                  )}
                >
                  Uploaded asset
                </button>
              </div>
              {source === "url" ? (
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://…"
                />
              ) : (
                <select
                  value={assetId}
                  onChange={(e) => setAssetId(e.target.value)}
                  className="flex h-9 w-full rounded-input border border-line bg-bg-2 px-3 text-sm text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
                >
                  <option value="">Pick an asset…</option>
                  {relevantAssets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ) : null}

          {kind === "link" ? (
            <div>
              <Label htmlFor="ref-url">URL</Label>
              <Input
                id="ref-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…"
              />
            </div>
          ) : null}

          {kind === "audio" ? (
            <div className="flex gap-2">
              <div className="flex-1">
                <Label htmlFor="ref-start">Start (sec)</Label>
                <Input
                  id="ref-start"
                  type="number"
                  min={0}
                  value={startSec}
                  onChange={(e) => setStartSec(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="flex-1">
                <Label htmlFor="ref-end">End (sec)</Label>
                <Input
                  id="ref-end"
                  type="number"
                  min={0}
                  value={endSec}
                  onChange={(e) => setEndSec(e.target.value)}
                  placeholder="Optional"
                />
              </div>
            </div>
          ) : null}

          <div>
            <Label htmlFor="ref-intent">Intent (optional)</Label>
            <Input
              id="ref-intent"
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              placeholder="Why this matters — e.g. vocal tone target"
            />
          </div>

          <div>
            <Label htmlFor="ref-note">{kind === "note" ? "Note" : "Extra note (optional)"}</Label>
            <Textarea
              id="ref-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={kind === "note" ? 4 : 2}
              placeholder={kind === "note" ? "Write your note…" : undefined}
              required={kind === "note"}
            />
          </div>

          {error ? <p className="text-sm text-warn">{error}</p> : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : initial ? "Save changes" : "Add reference"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
