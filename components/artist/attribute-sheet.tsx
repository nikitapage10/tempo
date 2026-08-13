"use client";

import * as React from "react";
import { Trophy } from "lucide-react";
import { AttributeRadar } from "@/components/artist/attribute-radar";
import { AttributeRow } from "@/components/artist/attribute-row";
import { AchievementToast } from "@/components/gamification/achievement-toast";
import { useToast } from "@/components/ui/toast";
import { SectionHeader } from "@/components/ui/section-header";
import { useArtistAttributes } from "@/hooks/use-artist-attributes";
import { useAchievementAwards, useAchievementSync } from "@/hooks/use-achievements";
import type { Artist } from "@/lib/types";
import { cn } from "@/lib/utils";

export type GamificationDisplay = "full" | "dim";

const COLD_START_MIN_TRACKS = 3;

/**
 * The feature-tier module: radar + rows in `full`, a plain figures list in
 * `dim`. Owns the one-time backfill / live-evaluate sync and queues
 * achievement toasts as they fire — `off` is handled entirely upstream by
 * simply not placing this module in the layout (see lib/workspace-presets.ts).
 */
export function AttributeSheet({
  artist,
  trackCount,
  display,
  onDisplayChange,
}: {
  artist: Artist;
  trackCount: number;
  display: GamificationDisplay;
  onDisplayChange: (display: GamificationDisplay) => void;
}) {
  const { data: attributes, isLoading } = useArtistAttributes(artist);
  const { data: awards } = useAchievementAwards(artist.id);
  const { queue, dequeue } = useAchievementSync(artist.id);
  const { toastCustom } = useToast();
  const [expandedKey, setExpandedKey] = React.useState<string | null>(null);

  // Queue achievement toasts one at a time as they arrive.
  const shownRef = React.useRef(0);
  React.useEffect(() => {
    if (queue.length === 0 || shownRef.current >= queue.length) return;
    const next = queue[shownRef.current];
    shownRef.current += 1;
    toastCustom(<AchievementToast achievement={next} />, undefined);
    if (shownRef.current >= queue.length) {
      // Let the toast own the remaining lifetime; clear the queue state so a
      // remount doesn't attempt to re-show the same ones.
      window.setTimeout(dequeue, 0);
    }
  }, [queue, toastCustom, dequeue]);

  const backfilledCount = React.useMemo(
    () => (awards ?? []).filter((a) => a.source === "backfill").length,
    [awards]
  );

  if (trackCount < COLD_START_MIN_TRACKS) {
    return (
      <section className="panel prism-edge p-6">
        <SectionHeader label="Artist attributes" />
        <p className="mt-2 text-sm text-text-lo">
          Your attribute sheet opens up once you’ve got a few tracks in.
        </p>
      </section>
    );
  }

  return (
    <section className="panel prism-edge p-6">
      <div className="flex items-start justify-between gap-3">
        <SectionHeader label="Artist attributes" />
        <DisplayToggle display={display} onChange={onDisplayChange} />
      </div>

      {backfilledCount > 0 ? (
        <p className="mb-3 flex items-center gap-1.5 text-xs text-text-lo">
          <Trophy className="size-3.5 text-amber" />
          {backfilledCount} achievement{backfilledCount === 1 ? "" : "s"} unlocked from your
          history.
        </p>
      ) : null}

      {isLoading || !attributes ? (
        <div className="h-48 animate-pulse rounded-panel bg-bg-2/40" />
      ) : display === "full" ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,260px)_1fr]">
          <AttributeRadar
            attributes={attributes}
            highlightKey={expandedKey}
            onSelect={(key) => setExpandedKey((prev) => (prev === key ? null : key))}
          />
          <div>
            {attributes.map((a) => (
              <AttributeRow
                key={a.key}
                attribute={a}
                expanded={expandedKey === a.key}
                onToggle={() => setExpandedKey((prev) => (prev === a.key ? null : a.key))}
              />
            ))}
          </div>
        </div>
      ) : (
        <div>
          {attributes.map((a) => (
            <AttributeRow
              key={a.key}
              attribute={a}
              expanded={expandedKey === a.key}
              onToggle={() => setExpandedKey((prev) => (prev === a.key ? null : a.key))}
              variant="compact"
            />
          ))}
        </div>
      )}
    </section>
  );
}

function DisplayToggle({
  display,
  onChange,
}: {
  display: GamificationDisplay;
  onChange: (display: GamificationDisplay) => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-0.5 rounded-chip border border-line p-0.5">
      {(["full", "dim"] as const).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={cn(
            "rounded-chip px-2 py-1 text-[11px] capitalize transition-colors duration-hover",
            display === option
              ? "bg-bg-2 text-ice"
              : "text-text-lo hover:text-text-hi"
          )}
          aria-pressed={display === option}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
