"use client";

import { Users } from "lucide-react";
import { ArtistMark } from "@/components/artists/artist-mark";
import type { ConversationPeer } from "@/lib/types";
import { cn } from "@/lib/utils";

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
    return (
      <ArtistMark
        emblemUrl={person.emblem_url}
        paletteId={person.palette_id}
        iceColor={person.ice_color}
        amberColor={person.amber_color}
        name={person.display_name}
        size={size}
        className={cn("shrink-0", className)}
      />
    );
  }
  const nested = Math.round(size * 0.72);
  return (
    <span className={cn("relative inline-block shrink-0", className)} style={{ width: size, height: size }}>
      <ArtistMark
        emblemUrl={shown[0].emblem_url}
        paletteId={shown[0].palette_id}
        iceColor={shown[0].ice_color}
        amberColor={shown[0].amber_color}
        name={shown[0].display_name}
        size={nested}
        className="absolute left-0 top-0"
      />
      <ArtistMark
        emblemUrl={shown[1].emblem_url}
        paletteId={shown[1].palette_id}
        iceColor={shown[1].ice_color}
        amberColor={shown[1].amber_color}
        name={shown[1].display_name}
        size={nested}
        className="absolute bottom-0 right-0 ring-1 ring-bg-1"
      />
    </span>
  );
}
