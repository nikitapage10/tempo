"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, ImagePlus } from "lucide-react";
import { FlareLine } from "@/components/flare-line";
import { SpectraCoverArt } from "@/components/spectra/spectra-cover-art";
import { useToast } from "@/components/ui/toast";
import { useAssetMutations } from "@/hooks/use-assets";
import { MOMENTUM_OPTIONS } from "@/lib/constants";
import {
  formatTrackType,
  momentumDotClass,
} from "@/lib/track-style";
import type { Momentum, Stage, Track, TrackUpdate } from "@/lib/types";
import { cn } from "@/lib/utils";

type TrackHeaderProps = {
  track: Track;
  stages: Stage[];
  versionCount: number;
  onPatch: (patch: TrackUpdate) => Promise<void>;
  /** Hide the stage dropdown — used when a stage timeline is the primary control. */
  hideStage?: boolean;
  /** Render without the outer bordered/background chrome (a wrapper supplies it). */
  bare?: boolean;
  /** Routes stage changes through the recipe-aware transition helper instead of a plain patch. */
  onStageChange?: (stageId: string) => void;
};

export function TrackHeader({
  track,
  stages,
  versionCount,
  onPatch,
  hideStage = false,
  bare = false,
  onStageChange,
}: TrackHeaderProps) {
  const [title, setTitle] = React.useState(track.title);
  const [editingTitle, setEditingTitle] = React.useState(false);
  const [coverBusy, setCoverBusy] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const coverInputRef = React.useRef<HTMLInputElement>(null);
  const { upload } = useAssetMutations(track.id);
  const { toast } = useToast();

  React.useEffect(() => {
    setTitle(track.title);
  }, [track.title]);

  React.useEffect(() => {
    if (editingTitle) inputRef.current?.focus();
  }, [editingTitle]);

  async function commitTitle() {
    setEditingTitle(false);
    const next = title.trim();
    if (!next || next === track.title) {
      setTitle(track.title);
      return;
    }
    await onPatch({ title: next });
  }

  async function handleCover(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast("Pick an image file (png, jpg, webp) for the cover.");
      return;
    }
    setCoverBusy(true);
    try {
      await upload.mutateAsync({ file, kind: "artwork" });
      toast("Cover updated", "ok");
    } catch (err) {
      toast(
        err instanceof Error
          ? err.message
          : "Couldn’t upload cover — try a smaller image."
      );
    } finally {
      setCoverBusy(false);
    }
  }

  const metaParts: string[] = [];
  if (track.bpm != null) metaParts.push(`${track.bpm} BPM`);
  if (track.musical_key) metaParts.push(track.musical_key);
  metaParts.push(
    versionCount === 1 ? "1 version" : `${versionCount} versions`
  );
  metaParts.push(formatTrackType(track.type));

  const content = (
    <>
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:gap-5 sm:p-5">
        <div className="shrink-0">
          <button
            type="button"
            className="group relative size-20 overflow-hidden rounded-input border border-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice sm:size-24"
            aria-label="Upload cover art"
            disabled={coverBusy}
            onClick={() => coverInputRef.current?.click()}
          >
            <SpectraCoverArt
              trackId={track.id}
              title={track.title}
              artworkUrl={track.artwork_url}
              animate={false}
            />
            <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-bg-0/70 opacity-0 transition-opacity duration-hover group-hover:opacity-100 group-focus-visible:opacity-100">
              <ImagePlus className="size-5 text-ice" />
              <span className="text-[10px] text-text-hi">
                {coverBusy ? "Uploading…" : "Cover"}
              </span>
            </span>
          </button>
          <input
            ref={coverInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif"
            className="hidden"
            onChange={(e) => {
              void handleCover(e.target.files);
              e.target.value = "";
            }}
          />
          <p className="mt-1.5 max-w-[6rem] text-center text-[10px] text-text-lo sm:max-w-[6.5rem]">
            Tap to set cover
          </p>
        </div>

        <div className="min-w-0 flex-1">
          <Link
            href="/board"
            className="mb-2 inline-flex items-center gap-1.5 text-xs text-text-lo transition-colors duration-hover hover:text-ice"
          >
            <ArrowLeft className="size-3.5" />
            Board
          </Link>

          {editingTitle ? (
            <input
              ref={inputRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => void commitTitle()}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void commitTitle();
                }
                if (e.key === "Escape") {
                  setTitle(track.title);
                  setEditingTitle(false);
                }
              }}
              className="w-full rounded-input border border-line bg-bg-2 px-2 py-1 font-display text-xl font-semibold tracking-tight text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice sm:text-2xl"
              aria-label="Track title"
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditingTitle(true)}
              className="block w-full rounded-input text-left font-display text-xl font-semibold tracking-tight text-text-hi transition-colors duration-hover hover:text-ice sm:text-2xl"
            >
              {track.title}
            </button>
          )}

          <p className="mt-1.5 font-mono text-[12px] text-text-lo">
            {metaParts.join(" · ")}
          </p>

          {track.spotify_track_id ? (
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 font-data text-[11px] text-text-lo">
              <span className="text-[#1DB954]">Spotify</span>
              {track.spotify_album_name ? <span>{track.spotify_album_name}</span> : null}
              {track.spotify_release_date ? <span>{track.spotify_release_date}</span> : null}
              {track.spotify_isrc ? <span>ISRC {track.spotify_isrc}</span> : null}
              {track.spotify_url ? (
                <a
                  href={track.spotify_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[#1DB954] hover:underline"
                >
                  Open Spotify <ExternalLink className="size-2.5" />
                </a>
              ) : null}
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="track-momentum">
              Momentum
            </label>
            <div className="relative">
              <span
                className={cn(
                  "pointer-events-none absolute left-2.5 top-1/2 size-2 -translate-y-1/2 rounded-full",
                  momentumDotClass(track.momentum)
                )}
                aria-hidden
              />
              <select
                id="track-momentum"
                value={track.momentum}
                onChange={(e) =>
                  void onPatch({ momentum: e.target.value as Momentum })
                }
                className="h-8 appearance-none rounded-input border border-line bg-bg-2 py-1 pl-7 pr-8 text-xs text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
              >
                {MOMENTUM_OPTIONS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {hideStage ? null : (
              <>
                <label className="sr-only" htmlFor="track-stage">
                  Stage
                </label>
                <select
                  id="track-stage"
                  value={track.stage_id ?? ""}
                  onChange={(e) => {
                    const stageId = e.target.value;
                    if (!stageId) {
                      void onPatch({ stage_id: null });
                      return;
                    }
                    if (onStageChange) onStageChange(stageId);
                    else void onPatch({ stage_id: stageId });
                  }}
                  className="h-8 rounded-input border border-line bg-bg-2 px-2.5 text-xs text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
                >
                  <option value="">No stage</option>
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </>
            )}

            <label className="sr-only" htmlFor="track-deadline">
              Deadline
            </label>
            <input
              id="track-deadline"
              type="date"
              value={track.deadline ?? ""}
              onChange={(e) =>
                void onPatch({ deadline: e.target.value || null })
              }
              className="h-8 rounded-input border border-line bg-bg-2 px-2.5 font-mono text-xs text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
            />
          </div>
        </div>
      </div>
      <FlareLine />
    </>
  );

  if (bare) return content;

  return (
    <header className="overflow-hidden rounded-card border border-line bg-bg-1">
      {content}
    </header>
  );
}
