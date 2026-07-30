"use client";

import * as React from "react";
import Link from "next/link";
import { useActiveArtistPalette } from "@/components/active-artist-provider";
import { stageHueAt } from "@/lib/stage-hue";
import type { SpacePipeline } from "@/lib/artist-stats";

/**
 * Where the work sits in each space's pipeline.
 *
 * One stacked bar per space rather than one row per stage: stage names repeat
 * across spaces ("Idea" exists in every music space), so a flat list of every
 * stage is both ambiguous and long — two spaces of six stages is twelve
 * near-identical rows. Grouping keeps it to two lines per space however many
 * spaces the artist has.
 *
 * Colour is the Board's ice → white → amber heat ramp, which is ordinal along
 * the pipeline. Identity never rests on it: the chips below each bar name
 * every stage and carry its count, so nothing is colour- or hover-only.
 */
export function PipelineBars({ pipelines }: { pipelines: SpacePipeline[] }) {
  const hues = useActiveArtistPalette();

  // A space with nothing staged has no pipeline to show, and an empty-state
  // line per space is precisely the clutter this section has to avoid. Count
  // them in one quiet footnote instead.
  const staffed = pipelines.filter((p) => p.total > 0);
  const emptyCount = pipelines.length - staffed.length;

  if (pipelines.length === 0) {
    return (
      <p className="text-sm text-text-lo">
        No music spaces yet — a space sets up its pipeline when you create it.
      </p>
    );
  }

  if (staffed.length === 0) {
    return (
      <p className="text-sm text-text-lo">
        Nothing is on a board yet. Tracks appear here once they have a stage.
      </p>
    );
  }

  return (
    <>
      <ul className="space-y-5">
        {staffed.map((pipeline) => {
          const staged = pipeline.stages.filter((s) => s.count > 0);
          return (
            <li key={pipeline.spaceId}>
              <div className="mb-2 flex items-baseline gap-2">
                <span className="min-w-0 flex-1 truncate text-[12px] text-text-hi">
                  {pipeline.spaceName}
                </span>
                <span className="text-[11px] tabular-nums text-text-lo">
                  {pipeline.total} track{pipeline.total === 1 ? "" : "s"} staged
                </span>
              </div>

              {/* 2px surface gaps separate the segments — never strokes. */}
              <div className="flex h-3 w-full gap-[2px]">
                {staged.map((stage) => (
                  <span
                    key={stage.id}
                    className="h-full first:rounded-l-[4px] last:rounded-r-[4px]"
                    style={{
                      width: `${(stage.count / pipeline.total) * 100}%`,
                      background: stageHueAt(stage.progress, hues),
                    }}
                    title={`${stage.name}: ${stage.count}`}
                  />
                ))}
              </div>

              <ul className="mt-2.5 flex flex-wrap gap-x-3.5 gap-y-1.5">
                {staged.map((stage) => (
                  <li
                    key={stage.id}
                    className="flex items-center gap-1.5 text-[11px] text-text-lo"
                  >
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ background: stageHueAt(stage.progress, hues) }}
                      aria-hidden
                    />
                    {stage.name}
                    <span className="tabular-nums text-text-hi">
                      {stage.count}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>

      {emptyCount > 0 ? (
        <p className="mt-4 text-[11px] text-text-lo">
          {emptyCount} other space{emptyCount === 1 ? "" : "s"} with nothing
          staged yet.
        </p>
      ) : null}
    </>
  );
}

/**
 * Momentum split as one thin part-to-whole bar. Ordinal, so a single hue
 * stepped by lightness (active brightest → parked dimmest); 2px surface gaps
 * separate the segments rather than strokes.
 */
export function MomentumBar({
  momentum,
  ramp,
}: {
  momentum: { value: string; label: string; count: number }[];
  ramp: string[];
}) {
  const total = momentum.reduce((sum, m) => sum + m.count, 0);
  if (total === 0) {
    return <p className="text-sm text-text-lo">No tracks yet.</p>;
  }

  return (
    <div>
      <div className="flex h-3 w-full gap-[2px] overflow-hidden">
        {momentum.map((m, i) =>
          m.count > 0 ? (
            <span
              key={m.value}
              className="h-full first:rounded-l-[4px] last:rounded-r-[4px]"
              style={{
                width: `${(m.count / total) * 100}%`,
                background: ramp[i] ?? ramp[ramp.length - 1],
              }}
              title={`${m.label}: ${m.count}`}
            />
          ) : null
        )}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {momentum.map((m, i) => (
          <li
            key={m.value}
            className="flex items-center gap-1.5 text-[11px] text-text-lo"
          >
            <span
              className="size-2 rounded-full"
              style={{ background: ramp[i] ?? ramp[ramp.length - 1] }}
              aria-hidden
            />
            {m.label}
            <span className="tabular-nums text-text-hi">{m.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Oldest unfinished tracks — the honest counterweight to the output chart. */
export function LingeringList({
  items,
}: {
  items: {
    track: { id: string; title: string };
    daysOpen: number;
    daysInStage: number;
    stageName: string | null;
  }[];
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-text-lo">
        Nothing has been sitting around — everything is either finished or
        parked.
      </p>
    );
  }
  return (
    <ul className="space-y-1">
      {items.map((item) => (
        <li key={item.track.id}>
          <Link
            href={`/track/${item.track.id}`}
            className="well lift flex items-center gap-3 rounded-input px-3 py-2"
          >
            <span className="min-w-0 flex-1 truncate text-sm text-text-hi">
              {item.track.title}
            </span>
            <span className="shrink-0 text-[11px] text-text-lo">
              {item.stageName ?? "No stage"}
              {" · "}
              <span className="tabular-nums">{item.daysInStage}d</span> in stage
            </span>
            <span className="shrink-0 text-[11px] tabular-nums text-amber">
              {item.daysOpen}d old
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
