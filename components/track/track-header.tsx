"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SignedImage } from "@/components/ui/signed-image";
import { MOMENTUM_OPTIONS } from "@/lib/constants";
import {
  formatTrackType,
  gradientFromTrackId,
  momentumDotClass,
} from "@/lib/track-style";
import type { Momentum, Stage, Track, TrackUpdate } from "@/lib/types";
import { cn } from "@/lib/utils";

type TrackHeaderProps = {
  track: Track;
  stages: Stage[];
  versionCount: number;
  onPatch: (patch: TrackUpdate) => Promise<void>;
};

export function TrackHeader({
  track,
  stages,
  versionCount,
  onPatch,
}: TrackHeaderProps) {
  const [title, setTitle] = React.useState(track.title);
  const [editingTitle, setEditingTitle] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

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

  const metaParts: string[] = [];
  if (track.bpm != null) metaParts.push(`${track.bpm} BPM`);
  if (track.musical_key) metaParts.push(track.musical_key);
  metaParts.push(
    versionCount === 1 ? "1 version" : `${versionCount} versions`
  );
  metaParts.push(formatTrackType(track.type));

  return (
    <header className="overflow-hidden rounded-card border border-line bg-bg-1">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:gap-5 sm:p-5">
        <div
          className="relative size-20 shrink-0 overflow-hidden rounded-input border border-line sm:size-24"
          style={{ background: gradientFromTrackId(track.id) }}
        >
          <SignedImage
            path={track.artwork_url}
            className="absolute inset-0 size-full"
          />
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

            <label className="sr-only" htmlFor="track-stage">
              Stage
            </label>
            <select
              id="track-stage"
              value={track.stage_id ?? ""}
              onChange={(e) =>
                void onPatch({ stage_id: e.target.value || null })
              }
              className="h-8 rounded-input border border-line bg-bg-2 px-2.5 text-xs text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
            >
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

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
      <div className="flare-line" />
    </header>
  );
}
