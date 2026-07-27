"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { copyToClipboard } from "@/lib/csv-export";
import type { ReleaseTrackMetadata, Track, Version } from "@/lib/types";
import { cn } from "@/lib/utils";

type ReleaseTrackRowProps = {
  track: Track;
  index: number;
  total: number;
  metadata: ReleaseTrackMetadata | null;
  versions: Version[];
  onMove: (direction: -1 | 1) => void;
  onSave: (patch: Partial<ReleaseTrackMetadata>) => Promise<void>;
};

function arrToStr(arr: string[] | undefined | null): string {
  return (arr ?? []).join(", ");
}
function strToArr(s: string): string[] {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

export function ReleaseTrackRow({
  track,
  index,
  total,
  metadata,
  versions,
  onMove,
  onSave,
}: ReleaseTrackRowProps) {
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [form, setForm] = React.useState({
    version_title: metadata?.version_title ?? "",
    isrc: metadata?.isrc ?? "",
    explicit: metadata?.explicit ?? false,
    primary_artist: metadata?.primary_artist ?? "",
    featured_artists: arrToStr(metadata?.featured_artists),
    writers: arrToStr(metadata?.writers),
    producers: arrToStr(metadata?.producers),
    mix_engineer: metadata?.mix_engineer ?? "",
    mastering_engineer: metadata?.mastering_engineer ?? "",
  });

  React.useEffect(() => {
    setForm({
      version_title: metadata?.version_title ?? "",
      isrc: metadata?.isrc ?? "",
      explicit: metadata?.explicit ?? false,
      primary_artist: metadata?.primary_artist ?? "",
      featured_artists: arrToStr(metadata?.featured_artists),
      writers: arrToStr(metadata?.writers),
      producers: arrToStr(metadata?.producers),
      mix_engineer: metadata?.mix_engineer ?? "",
      mastering_engineer: metadata?.mastering_engineer ?? "",
    });
  }, [metadata]);

  const master = versions.find((v) => v.is_pinned && v.milestone_type === "master");
  const current = versions.find((v) => v.is_current);
  const masterWarning = master && !master.is_current;

  const missing: string[] = [];
  if (!form.primary_artist.trim()) missing.push("Primary artist");
  if (!form.isrc.trim()) missing.push("ISRC");
  if (!track.artwork_url) missing.push("Artwork");
  if (!master) missing.push("Approved master");

  const isrcLooksOff = !!form.isrc.trim() && !/^[A-Z]{2}[A-Z0-9]{3}\d{7}$/i.test(form.isrc.trim());

  async function handleSave() {
    setBusy(true);
    try {
      await onSave({
        version_title: form.version_title.trim() || null,
        isrc: form.isrc.trim() || null,
        explicit: form.explicit,
        primary_artist: form.primary_artist.trim() || null,
        featured_artists: strToArr(form.featured_artists),
        writers: strToArr(form.writers),
        producers: strToArr(form.producers),
        mix_engineer: form.mix_engineer.trim() || null,
        mastering_engineer: form.mastering_engineer.trim() || null,
      });
      toast("Metadata saved", "ok");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn’t save metadata.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCopy() {
    const lines = [
      `${track.title}${form.version_title ? ` (${form.version_title})` : ""}`,
      `Primary artist: ${form.primary_artist || "—"}`,
      form.featured_artists ? `Featuring: ${form.featured_artists}` : null,
      `ISRC: ${form.isrc || "—"}`,
      form.writers ? `Writers: ${form.writers}` : null,
      form.producers ? `Producers: ${form.producers}` : null,
      form.mix_engineer ? `Mix: ${form.mix_engineer}` : null,
      form.mastering_engineer ? `Mastering: ${form.mastering_engineer}` : null,
      `Explicit: ${form.explicit ? "Yes" : "No"}`,
    ].filter(Boolean);
    const ok = await copyToClipboard(lines.join("\n"));
    toast(ok ? "Copied metadata to clipboard" : "Couldn’t copy — try again.", ok ? "ok" : "error");
  }

  return (
    <SpotlightCard
      as="li"
      radius={10}
      size={220}
      className="rounded-card border border-line bg-bg-2/40"
    >
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div className="flex flex-col">
          <button
            type="button"
            aria-label="Move up"
            disabled={index === 0}
            onClick={() => onMove(-1)}
            className="text-text-lo hover:text-ice disabled:opacity-30"
          >
            <ChevronUp className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label="Move down"
            disabled={index === total - 1}
            onClick={() => onMove(1)}
            className="text-text-lo hover:text-ice disabled:opacity-30"
          >
            <ChevronDown className="size-3.5" />
          </button>
        </div>
        <span className="w-5 shrink-0 text-center font-mono text-xs text-text-lo">
          {index + 1}
        </span>
        <Link
          href={`/track/${track.id}`}
          className="min-w-0 flex-1 truncate text-sm text-text-hi hover:text-ice"
        >
          {track.title}
        </Link>
        <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
          {master ? (
            <span
              className={cn(
                "rounded-chip border px-1.5 py-0.5 font-mono text-[10px]",
                masterWarning
                  ? "border-warn/30 bg-warn/10 text-warn"
                  : "border-ok/30 bg-ok/10 text-ok"
              )}
              title={masterWarning ? "Pinned master isn't the current version" : "Master pinned"}
            >
              {masterWarning ? "Master ≠ current" : "Master ✓"}
            </span>
          ) : (
            <span className="rounded-chip border border-line bg-bg-1 px-1.5 py-0.5 font-mono text-[10px] text-text-lo">
              No master
            </span>
          )}
          <span
            className={cn(
              "rounded-chip border px-1.5 py-0.5 font-mono text-[10px]",
              track.artwork_url
                ? "border-ok/30 bg-ok/10 text-ok"
                : "border-line bg-bg-1 text-text-lo"
            )}
          >
            {track.artwork_url ? "Art ✓" : "No art"}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="shrink-0 rounded-input px-2 py-1 text-[11px] text-ice hover:bg-ice/10"
          aria-expanded={open}
        >
          {open ? "Close" : "Edit metadata"}
        </button>
      </div>

      {missing.length > 0 ? (
        <p className="border-t border-line px-3 py-1.5 text-[11px] text-text-lo">
          Missing: {missing.join(", ")}
        </p>
      ) : null}

      {open ? (
        <div className="space-y-3 border-t border-line p-3">
          {!current ? (
            <p className="text-xs text-text-lo">No versions uploaded on this track yet.</p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor={`vt-${track.id}`}>Version title</Label>
              <Input
                id={`vt-${track.id}`}
                value={form.version_title}
                onChange={(e) => setForm((f) => ({ ...f, version_title: e.target.value }))}
                placeholder="Radio Edit, VIP…"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor={`isrc-${track.id}`}>ISRC</Label>
              <Input
                id={`isrc-${track.id}`}
                value={form.isrc}
                onChange={(e) => setForm((f) => ({ ...f, isrc: e.target.value.toUpperCase() }))}
                placeholder="USRC17607839"
                className="mt-1 font-mono"
              />
              {isrcLooksOff ? (
                <p className="mt-1 text-[11px] text-amber">
                  Doesn’t look like a standard ISRC — double check with your distributor.
                </p>
              ) : null}
            </div>
            <div>
              <Label htmlFor={`artist-${track.id}`}>Primary artist</Label>
              <Input
                id={`artist-${track.id}`}
                value={form.primary_artist}
                onChange={(e) => setForm((f) => ({ ...f, primary_artist: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor={`feat-${track.id}`}>Featured artists</Label>
              <Input
                id={`feat-${track.id}`}
                value={form.featured_artists}
                onChange={(e) => setForm((f) => ({ ...f, featured_artists: e.target.value }))}
                placeholder="Comma separated"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor={`writers-${track.id}`}>Writers</Label>
              <Input
                id={`writers-${track.id}`}
                value={form.writers}
                onChange={(e) => setForm((f) => ({ ...f, writers: e.target.value }))}
                placeholder="Comma separated"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor={`producers-${track.id}`}>Producers</Label>
              <Input
                id={`producers-${track.id}`}
                value={form.producers}
                onChange={(e) => setForm((f) => ({ ...f, producers: e.target.value }))}
                placeholder="Comma separated"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor={`mix-${track.id}`}>Mix engineer</Label>
              <Input
                id={`mix-${track.id}`}
                value={form.mix_engineer}
                onChange={(e) => setForm((f) => ({ ...f, mix_engineer: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor={`master-${track.id}`}>Mastering engineer</Label>
              <Input
                id={`master-${track.id}`}
                value={form.mastering_engineer}
                onChange={(e) => setForm((f) => ({ ...f, mastering_engineer: e.target.value }))}
                className="mt-1"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs text-text-lo">
            <input
              type="checkbox"
              checked={form.explicit}
              onChange={(e) => setForm((f) => ({ ...f, explicit: e.target.checked }))}
              className="size-3.5 accent-[var(--ice)]"
            />
            Explicit content
          </label>
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <Button type="button" size="sm" variant="ghost" onClick={() => void handleCopy()}>
              <Copy className="size-3.5" />
              Copy as text
            </Button>
            <Button type="button" size="sm" disabled={busy} onClick={() => void handleSave()}>
              {busy ? "Saving…" : "Save metadata"}
            </Button>
          </div>
        </div>
      ) : null}
    </SpotlightCard>
  );
}
