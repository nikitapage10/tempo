"use client";

import { ArtistMark } from "@/components/artists/artist-mark";
import type { SessionRoomMember } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Overlapping faces for a Session. Every mark gets a wrapper with real
 * dimensions — an emblem photo has no intrinsic box of its own.
 */
export function SessionAvatarStack({
  members,
  size = 26,
  max = 4,
  className,
}: {
  members: SessionRoomMember[];
  size?: number;
  max?: number;
  className?: string;
}) {
  const shown = members.slice(0, max);
  const extra = members.length - shown.length;

  return (
    <span className={cn("flex shrink-0 items-center", className)}>
      {shown.map((member, index) => (
        <span
          key={member.user_id}
          className="inline-flex overflow-hidden rounded-full ring-1 ring-bg-0/80"
          style={{ width: size, height: size, marginLeft: index === 0 ? 0 : -Math.round(size * 0.3) }}
          title={member.display_name}
        >
          <ArtistMark
            emblemUrl={member.emblem_url}
            paletteId={member.palette_id}
            iceColor={member.ice_color}
            amberColor={member.amber_color}
            name={member.display_name}
            size={size}
            className="size-full"
          />
        </span>
      ))}
      {extra > 0 ? (
        <span
          className="inline-flex items-center justify-center rounded-full border border-line bg-bg-2 font-data text-[10px] text-text-lo ring-1 ring-bg-0/80"
          style={{ width: size, height: size, marginLeft: -Math.round(size * 0.3) }}
        >
          +{extra}
        </span>
      ) : null}
    </span>
  );
}

/** Amber "a hang is open" marker. The one place amber outranks ice in Sessions. */
export function LivePill({ className, label = "Live" }: { className?: string; label?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-chip border border-amber/35 bg-amber/10 px-2 py-0.5 text-[11px] font-medium text-amber",
        className
      )}
    >
      <span className="relative flex size-1.5">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber/70 motion-reduce:hidden" />
        <span className="relative inline-flex size-1.5 rounded-full bg-amber" />
      </span>
      {label}
    </span>
  );
}
