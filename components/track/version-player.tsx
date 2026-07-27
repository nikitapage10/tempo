"use client";

import * as React from "react";
import WaveSurfer from "wavesurfer.js";
import { MessageSquarePlus, Pause, Play } from "lucide-react";
import { formatDuration } from "@/lib/format";
import { playbackCoordinator } from "@/lib/playback-coordinator";
import { getSignedUrl } from "@/lib/storage";
import type { Version } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useVersionMutations } from "@/hooks/use-versions";

export type WaveformMarker = {
  id: string;
  timestampSec: number;
  resolved?: boolean;
  title?: string;
};

export type VersionPlayerHandle = {
  /** Seeks the current waveform to a timestamp (queued until the file is ready). */
  seekTo: (seconds: number) => void;
};

type VersionPlayerProps = {
  trackId: string;
  versions: Version[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Comment markers for the currently loaded version only (FEATURE-SPECS §4). */
  markers?: WaveformMarker[];
  onMarkerClick?: (id: string) => void;
  /** "Add comment here" — called with the current playhead position. */
  onAddCommentClick?: (timestampSec: number) => void;
  onTimeUpdate?: (seconds: number) => void;
};

export const VersionPlayer = React.forwardRef<VersionPlayerHandle, VersionPlayerProps>(
  function VersionPlayer(
    {
      trackId,
      versions,
      selectedId,
      onSelect,
      markers,
      onMarkerClick,
      onAddCommentClick,
      onTimeUpdate,
    },
    ref
  ) {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const wsRef = React.useRef<WaveSurfer | null>(null);
    const pendingSeekRef = React.useRef<number | null>(null);
    const [ready, setReady] = React.useState(false);
    const [playing, setPlaying] = React.useState(false);
    const [currentTime, setCurrentTime] = React.useState(0);
    const [duration, setDuration] = React.useState(0);
    const [loadError, setLoadError] = React.useState<string | null>(null);
    const { setDuration: persistDuration } = useVersionMutations(trackId);

    const selected =
      versions.find((v) => v.id === selectedId) ??
      versions.find((v) => v.is_current) ??
      versions[0] ??
      null;

    const playbackId = `version-player:${trackId}`;

    React.useImperativeHandle(
      ref,
      () => ({
        seekTo(seconds: number) {
          const ws = wsRef.current;
          const clamped = Math.max(0, seconds);
          if (ws && ready) {
            const d = ws.getDuration();
            ws.setTime(d > 0 ? Math.min(clamped, d) : clamped);
            setCurrentTime(clamped);
          } else {
            pendingSeekRef.current = clamped;
          }
        },
      }),
      [ready]
    );

    React.useEffect(() => {
      if (selected && selected.id !== selectedId) {
        onSelect(selected.id);
      }
    }, [selected, selectedId, onSelect]);

    React.useEffect(() => {
      if (!containerRef.current || !selected) return;

      let cancelled = false;
      setReady(false);
      setPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      setLoadError(null);

      const ws = WaveSurfer.create({
        container: containerRef.current,
        waveColor: "#8B8B96",
        progressColor: "#7FB4FF",
        cursorColor: "#FFB56B",
        barWidth: 2,
        barGap: 1,
        barRadius: 1,
        height: 72,
        normalize: true,
      });
      wsRef.current = ws;

      // Ice→amber progress gradient (spec §5)
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const grad = ctx.createLinearGradient(0, 0, 800, 0);
          grad.addColorStop(0, "#7FB4FF");
          grad.addColorStop(1, "#FFB56B");
          ws.setOptions({ progressColor: grad as unknown as string });
        }
      } catch {
        /* keep solid ice */
      }

      const unregister = playbackCoordinator.register(playbackId, () => {
        ws.pause();
      });

      ws.on("ready", () => {
        if (cancelled) return;
        setReady(true);
        const d = ws.getDuration();
        setDuration(d);
        if (selected && (selected.duration == null || Math.abs((selected.duration ?? 0) - d) > 0.5)) {
          persistDuration.mutate({ versionId: selected.id, duration: d });
        }
        if (pendingSeekRef.current != null) {
          const clamped = d > 0 ? Math.min(pendingSeekRef.current, d) : pendingSeekRef.current;
          ws.setTime(clamped);
          setCurrentTime(clamped);
          pendingSeekRef.current = null;
        }
      });
      ws.on("play", () => {
        setPlaying(true);
        playbackCoordinator.notifyPlay(playbackId);
      });
      ws.on("pause", () => {
        setPlaying(false);
        playbackCoordinator.notifyStop(playbackId);
      });
      ws.on("timeupdate", (t) => {
        setCurrentTime(t);
        onTimeUpdate?.(t);
      });
      ws.on("finish", () => {
        setPlaying(false);
        playbackCoordinator.notifyStop(playbackId);
      });
      ws.on("error", () => {
        if (!cancelled) {
          setLoadError(
            "Couldn’t load this bounce — try downloading it, or re-upload if the file is corrupt."
          );
        }
      });

      getSignedUrl(selected.file_url)
        .then((url) => {
          if (cancelled) return;
          return ws.load(url);
        })
        .catch(() => {
          if (!cancelled) {
            setLoadError(
              "Couldn’t get a playback link — sign in again, then refresh."
            );
          }
        });

      return () => {
        cancelled = true;
        unregister();
        ws.destroy();
        wsRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when version changes
    }, [selected?.id, selected?.file_url]);

    if (!versions.length) {
      return (
        <section className="rounded-card border border-dashed border-line bg-bg-1/60 p-4">
          <h2 className="mb-2 font-mono text-[11px] uppercase tracking-[0.08em] text-text-lo">
            Player
          </h2>
          <p className="text-sm text-text-lo">
            Upload a bounce and the waveform player will live here.
          </p>
        </section>
      );
    }

    const effectiveDuration = duration || selected?.duration || 0;

    return (
      <section className="rounded-card border border-line bg-bg-1 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-lo">
            Player
          </h2>
          <label className="flex items-center gap-2 text-xs text-text-lo">
            <span className="sr-only">Version</span>
            <select
              className="h-8 rounded-input border border-line bg-bg-2 px-2 font-mono text-xs text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
              value={selected?.id ?? ""}
              onChange={(e) => onSelect(e.target.value)}
            >
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.version_no}
                  {v.is_current ? " · current" : ""}
                  {v.label ? ` — ${v.label}` : ""}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="relative overflow-hidden rounded-input border border-line bg-bg-2/80">
          <div
            ref={containerRef}
            className="waveform-host w-full px-1 pt-2"
            style={
              {
                // Progress tint: ice→amber via mask overlay isn’t native;
                // use CSS custom property on progress wave if present.
                ["--wave-progress" as string]:
                  "linear-gradient(90deg, #7FB4FF, #FFB56B)",
              } as React.CSSProperties
            }
          />
          {!ready && !loadError ? (
            <div className="absolute inset-0 flex items-center justify-center bg-bg-2/60">
              <div className="h-10 w-full animate-pulse rounded bg-bg-1/80 mx-3" />
            </div>
          ) : null}

          {ready && effectiveDuration > 0 && markers && markers.length > 0 ? (
            <div
              className="pointer-events-none absolute inset-x-1 bottom-1 top-2 z-10"
              aria-hidden={false}
            >
              {markers.map((marker) => {
                const pct = Math.min(
                  100,
                  Math.max(0, (marker.timestampSec / effectiveDuration) * 100)
                );
                return (
                  <button
                    key={marker.id}
                    type="button"
                    className={cn(
                      "pointer-events-auto absolute bottom-0 flex size-3 -translate-x-1/2 items-center justify-center rounded-full border transition-transform duration-hover hover:scale-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice",
                      marker.resolved
                        ? "border-text-lo/60 bg-bg-1"
                        : "border-amber bg-amber/80"
                    )}
                    style={{ left: `${pct}%` }}
                    onClick={() => onMarkerClick?.(marker.id)}
                    aria-label={`Comment at ${formatDuration(marker.timestampSec)}${
                      marker.title ? `: ${marker.title}` : ""
                    }${marker.resolved ? " (resolved)" : ""}`}
                    title={`${formatDuration(marker.timestampSec)}${
                      marker.title ? ` — ${marker.title}` : ""
                    }`}
                  />
                );
              })}
            </div>
          ) : null}
        </div>

        {loadError ? (
          <p className="mt-2 text-sm text-warn" role="alert">
            {loadError}
          </p>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!ready}
            className={cn(
              "flex size-9 items-center justify-center rounded-full bg-ice text-bg-0 transition-opacity duration-hover",
              "hover:opacity-90 disabled:opacity-40"
            )}
            aria-label={playing ? "Pause" : "Play"}
            onClick={() => {
              const ws = wsRef.current;
              if (!ws) return;
              void ws.playPause();
            }}
          >
            {playing ? (
              <Pause className="size-4" fill="currentColor" />
            ) : (
              <Play className="size-4 translate-x-px" fill="currentColor" />
            )}
          </button>
          <span className="font-mono text-xs text-text-lo">
            <span className="text-text-hi">{formatDuration(currentTime)}</span>
            {" / "}
            {formatDuration(effectiveDuration)}
          </span>
          {onAddCommentClick ? (
            <button
              type="button"
              disabled={!ready}
              onClick={() => onAddCommentClick(currentTime)}
              className="flex items-center gap-1.5 rounded-input border border-line px-2.5 py-1.5 text-xs text-text-lo transition-colors duration-hover hover:border-ice/40 hover:text-ice disabled:opacity-40"
            >
              <MessageSquarePlus className="size-3.5" />
              Add comment here
            </button>
          ) : null}
          {selected?.is_current ? (
            <span className="ml-auto font-mono text-[11px] text-amber">
              current
            </span>
          ) : null}
        </div>
      </section>
    );
  }
);
