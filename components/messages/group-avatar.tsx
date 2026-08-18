"use client";

import { Users } from "lucide-react";
import { ArtistMark } from "@/components/artists/artist-mark";
import type { ConversationPeer } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * ArtistMark only applies its `size` when no className is passed, and an
 * emblem photo carries no intrinsic box at all — so every mark here gets a
 * wrapper with real dimensions and fills it. Without that, a member with a
 * profile photo rendered at the photo's natural size and blew the card apart.
 */
function SizedMark({
  person,
  size,
  className,
}: {
  person: ConversationPeer;
  size: number;
  className?: string;
}) {
  return (
    <span
      className={cn("inline-flex shrink-0 overflow-hidden rounded-full", className)}
      style={{ width: size, height: size }}
    >
      <ArtistMark
        emblemUrl={person.emblem_url}
        paletteId={person.palette_id}
        iceColor={person.ice_color}
        amberColor={person.amber_color}
        name={person.display_name}
        size={size}
        className="size-full"
      />
    </span>
  );
}

export function GroupAvatar({
  members,
  size = 18,
  className,
}: {
  members?: ConversationPeer[] | null;
  size?: number;
  className?: string;
}) {
  const shown = (members ?? []).slice(0, 2);
  if (shown.length < 2) {
    const person = shown[0];
    if (!person) {
      return (
        <span
          className={cn("inline-flex shrink-0 items-center justify-center rounded-full border border-ice/25 bg-ice/10", className)}
          style={{ width: size, height: size }}
        >
          <Users className="size-[60%] text-ice" />
        </span>
      );
    }
    return <SizedMark person={person} size={size} className={className} />;
  }
  const nested = Math.round(size * 0.72);
  return (
    <span className={cn("relative inline-block shrink-0", className)} style={{ width: size, height: size }}>
      <SizedMark person={shown[0]} size={nested} className="absolute left-0 top-0" />
      <SizedMark person={shown[1]} size={nested} className="absolute bottom-0 right-0 ring-1 ring-bg-1" />
    </span>
  );
}
