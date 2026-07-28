"use client";

import * as React from "react";
import { TrackHeader } from "@/components/track/track-header";
import { extractArtworkTint, tintFromTrackId } from "@/lib/artwork-tint";
import { getSignedUrl } from "@/lib/storage";
import type { Stage, Track, TrackUpdate } from "@/lib/types";

type TrackAmbientHeaderProps = {
  track: Track;
  stages: Stage[];
  versionCount: number;
  onPatch: (patch: TrackUpdate) => Promise<void>;
  /** Show the stage dropdown alongside momentum/deadline. Default off — the stage timeline is primary (V2 §5). */
  showStageDropdown?: boolean;
  /** Routes stage changes through the recipe-aware transition helper instead of a plain patch. */
  onStageChange?: (stageId: string) => void;
  /**
   * Track-level controls (the Edit menu), pinned to the header's bottom-right.
   * Sits inside the header rather than in its own row so it costs no vertical
   * space of its own.
   */
  actions?: React.ReactNode;
};

/**
 * Wraps TrackHeader with a soft artwork-derived ambient tint, clipped to the
 * header region only (V2 §5). Falls back to a deterministic hash tint when
 * there's no artwork or extraction fails.
 */
export function TrackAmbientHeader({
  track,
  stages,
  versionCount,
  onPatch,
  showStageDropdown = false,
  onStageChange,
  actions,
}: TrackAmbientHeaderProps) {
  const [tint, setTint] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    if (!track.artwork_url) {
      setTint(tintFromTrackId(track.id));
      return;
    }

    setTint(null);
    getSignedUrl(track.artwork_url)
      .then((url) => extractArtworkTint(url))
      .then((color) => {
        if (cancelled) return;
        setTint(color ?? tintFromTrackId(track.id));
      })
      .catch(() => {
        if (!cancelled) setTint(tintFromTrackId(track.id));
      });

    return () => {
      cancelled = true;
    };
  }, [track.artwork_url, track.id]);

  return (
    // The actions sit outside the clipped header below, otherwise the Edit
    // menu gets cut off by its overflow-hidden.
    <div className="relative">
    <header className="relative overflow-hidden rounded-card border border-line bg-bg-1">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 transition-opacity duration-700 ease-out motion-reduce:transition-none"
        style={{
          opacity: tint ? 0.14 : 0,
          background: tint
            ? `radial-gradient(120% 140% at 15% 0%, ${tint} 0%, transparent 62%)`
            : undefined,
        }}
      />
      <div className="relative">
        <TrackHeader
          track={track}
          stages={stages}
          versionCount={versionCount}
          onPatch={onPatch}
          hideStage={!showStageDropdown}
          onStageChange={onStageChange}
          bare
        />
      </div>
    </header>
    {actions ? (
      <div className="absolute bottom-3 right-3 z-30">{actions}</div>
    ) : null}
    </div>
  );
}
