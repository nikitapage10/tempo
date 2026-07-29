"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MOMENTUM_OPTIONS, TRACK_TYPES } from "@/lib/constants";
import type { Momentum, Stage, Track, TrackInsert, TrackType } from "@/lib/types";
import { cn } from "@/lib/utils";

type TrackFormValues = {
  title: string;
  type: TrackType;
  stage_id: string;
  artist_alias: string;
  bpm: string;
  musical_key: string;
  genre: string;
  destination: string;
  deadline: string;
  momentum: Momentum;
  tags: string;
  notes: string;
};

function emptyValues(defaultStageId: string): TrackFormValues {
  return {
    title: "",
    type: "original",
    stage_id: defaultStageId,
    artist_alias: "",
    bpm: "",
    musical_key: "",
    genre: "",
    destination: "",
    deadline: "",
    momentum: "active",
    tags: "",
    notes: "",
  };
}

function fromTrack(track: Track): TrackFormValues {
  return {
    title: track.title,
    type: track.type,
    stage_id: track.stage_id ?? "",
    artist_alias: track.artist_alias ?? "",
    bpm: track.bpm != null ? String(track.bpm) : "",
    musical_key: track.musical_key ?? "",
    genre: track.genre ?? "",
    destination: track.destination ?? "",
    deadline: track.deadline ?? "",
    momentum: track.momentum,
    tags: (track.tags ?? []).join(", "),
    notes: track.notes ?? "",
  };
}

function parseTags(raw: string): string[] {
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

type TrackFormModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spaceId: string;
  stages: Stage[];
  /** Prefill stage when creating (e.g. from a Board column +). */
  defaultStageId?: string | null;
  track?: Track | null;
  onSubmit: (values: TrackInsert & { id?: string }) => Promise<void>;
  onDelete?: () => Promise<void>;
};

export function TrackFormModal({
  open,
  onOpenChange,
  spaceId,
  stages,
  defaultStageId: defaultStageIdProp,
  track,
  onSubmit,
  onDelete,
}: TrackFormModalProps) {
  const isEdit = !!track;
  const defaultStageId =
    defaultStageIdProp && stages.some((s) => s.id === defaultStageIdProp)
      ? defaultStageIdProp
      : (stages[0]?.id ?? "");
  const [values, setValues] = React.useState<TrackFormValues>(() =>
    track ? fromTrack(track) : emptyValues(defaultStageId)
  );
  const [moreOpen, setMoreOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setValues(track ? fromTrack(track) : emptyValues(defaultStageId));
    setMoreOpen(false);
    setConfirmDelete(false);
    setError(null);
  }, [open, track, stages, defaultStageId]);

  function setField<K extends keyof TrackFormValues>(
    key: K,
    value: TrackFormValues[K]
  ) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!values.title.trim()) {
      setError("Give the track a title.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: TrackInsert & { id?: string } = {
        id: track?.id,
        space_id: spaceId,
        stage_id: values.stage_id || null,
        title: values.title.trim(),
        type: values.type,
        artist_alias: values.artist_alias.trim() || null,
        bpm: values.bpm ? Number(values.bpm) : null,
        musical_key: values.musical_key.trim() || null,
        genre: values.genre.trim() || null,
        destination: values.destination.trim() || null,
        deadline: values.deadline || null,
        momentum: values.momentum,
        tags: parseTags(values.tags),
        notes: values.notes.trim() || null,
      };
      await onSubmit(payload);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save track.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!onDelete) return;
    setSaving(true);
    setError(null);
    try {
      await onDelete();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete track.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={isEdit ? "Edit track" : "New track"}
        description={
          isEdit
            ? "Update details, or delete if you’re done with it."
            : "Title and type are enough — fill the rest when you know it."
        }
        onClose={() => onOpenChange(false)}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="track-title">Title</Label>
            <Input
              id="track-title"
              value={values.title}
              onChange={(e) => setField("title", e.target.value)}
              placeholder="Untitled bounce"
              autoFocus
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="track-type">Type</Label>
              <select
                id="track-type"
                value={values.type}
                onChange={(e) => setField("type", e.target.value as TrackType)}
                className="flex h-9 w-full rounded-input border border-line bg-bg-2 px-3 text-sm text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
              >
                {TRACK_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="track-stage">Stage</Label>
              <select
                id="track-stage"
                value={values.stage_id}
                onChange={(e) => setField("stage_id", e.target.value)}
                className="flex h-9 w-full rounded-input border border-line bg-bg-2 px-3 text-sm text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
              >
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            className="flex w-full items-center justify-between rounded-input border border-line bg-bg-2/50 px-3 py-2 text-sm text-text-lo transition-colors duration-hover hover:text-text-hi"
          >
            <span>More details</span>
            <ChevronDown
              className={cn(
                "size-4 transition-transform duration-hover",
                moreOpen && "rotate-180"
              )}
            />
          </button>

          {moreOpen ? (
            <div className="space-y-3 rounded-card border border-line bg-bg-0/40 p-3">
              <div>
                <Label htmlFor="track-alias">Artist / alias</Label>
                <Input
                  id="track-alias"
                  value={values.artist_alias}
                  onChange={(e) => setField("artist_alias", e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="track-bpm">BPM</Label>
                  <Input
                    id="track-bpm"
                    className="font-mono"
                    inputMode="decimal"
                    value={values.bpm}
                    onChange={(e) => setField("bpm", e.target.value)}
                    placeholder="124"
                  />
                </div>
                <div>
                  <Label htmlFor="track-key">Key</Label>
                  <Input
                    id="track-key"
                    className="font-mono"
                    value={values.musical_key}
                    onChange={(e) => setField("musical_key", e.target.value)}
                    placeholder="F♯m"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="track-genre">Genre</Label>
                  <Input
                    id="track-genre"
                    value={values.genre}
                    onChange={(e) => setField("genre", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="track-dest">Destination</Label>
                  <Input
                    id="track-dest"
                    value={values.destination}
                    onChange={(e) => setField("destination", e.target.value)}
                    placeholder="Label / self / pack"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="track-deadline">Deadline</Label>
                  <Input
                    id="track-deadline"
                    type="date"
                    value={values.deadline}
                    onChange={(e) => setField("deadline", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="track-momentum">Momentum</Label>
                  <select
                    id="track-momentum"
                    value={values.momentum}
                    onChange={(e) =>
                      setField("momentum", e.target.value as Momentum)
                    }
                    className="flex h-9 w-full rounded-input border border-line bg-bg-2 px-3 text-sm text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
                  >
                    {MOMENTUM_OPTIONS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <Label htmlFor="track-tags">Tags</Label>
                <Input
                  id="track-tags"
                  value={values.tags}
                  onChange={(e) => setField("tags", e.target.value)}
                  placeholder="club, vocal, summer — comma separated"
                />
              </div>
              <div>
                <Label htmlFor="track-notes">Notes</Label>
                <Textarea
                  id="track-notes"
                  value={values.notes}
                  onChange={(e) => setField("notes", e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          ) : null}

          {error ? <p className="text-sm text-warn">{error}</p> : null}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            {isEdit && onDelete ? (
              confirmDelete ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-warn">Delete for good?</span>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={saving}
                    onClick={handleDelete}
                  >
                    Yes, delete
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmDelete(false)}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={saving || values.momentum === "parked"}
                    onClick={async () => {
                      setField("momentum", "parked");
                      setSaving(true);
                      setError(null);
                      try {
                        await onSubmit({
                          id: track?.id,
                          space_id: spaceId,
                          stage_id: values.stage_id || null,
                          title: values.title.trim(),
                          type: values.type,
                          artist_alias: values.artist_alias.trim() || null,
                          bpm: values.bpm ? Number(values.bpm) : null,
                          musical_key: values.musical_key.trim() || null,
                          genre: values.genre.trim() || null,
                          destination: values.destination.trim() || null,
                          deadline: values.deadline || null,
                          momentum: "parked",
                          tags: parseTags(values.tags),
                          notes: values.notes.trim() || null,
                        });
                        onOpenChange(false);
                      } catch (err) {
                        setError(
                          err instanceof Error
                            ? err.message
                            : "Could not park track."
                        );
                      } finally {
                        setSaving(false);
                      }
                    }}
                  >
                    Park track
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-warn hover:text-warn"
                    onClick={() => setConfirmDelete(true)}
                  >
                    Delete
                  </Button>
                </div>
              )
            ) : (
              // Adding one track at a time is the slow way in when you've got a
              // whole catalog sitting in a folder somewhere.
              <Link
                href="/import"
                onClick={() => onOpenChange(false)}
                className="inline-flex items-center gap-1.5 text-xs text-text-lo underline-offset-4 transition-colors duration-hover hover:text-ice hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
              >
                <Sparkles className="size-3.5" />
                Got a lot to add? Import them all
              </Link>
            )}
            <div className="ml-auto flex gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : isEdit ? "Save" : "Create track"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
