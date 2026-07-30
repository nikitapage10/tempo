"use client";

import { X } from "lucide-react";
import { useActiveArtist } from "@/components/active-artist-provider";
import { ArtistMark } from "@/components/artists/artist-mark";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  hasUnread: boolean;
  onToggle: () => void;
  launcherRef?: React.Ref<HTMLButtonElement>;
};

export function AssistantLauncher({
  open,
  hasUnread,
  onToggle,
  launcherRef,
}: Props) {
  const { activeArtist } = useActiveArtist();

  return (
    <button
      ref={launcherRef}
      type="button"
      aria-label={open ? "Close assistant" : "Open assistant"}
      aria-expanded={open}
      aria-controls="tempo-assistant-panel"
      onClick={onToggle}
      className={cn(
        "fixed bottom-20 right-4 z-[90] flex size-12 items-center justify-center overflow-hidden rounded-full border border-line bg-bg-2 shadow-e3 transition-shadow duration-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice md:bottom-5 md:right-5",
        open && "glow-ice",
        "hover:glow-ice",
      )}
    >
      {open ? (
        <X className="size-5 text-text-hi" strokeWidth={1.75} />
      ) : activeArtist ? (
        <ArtistMark
          emblemUrl={activeArtist.emblem_url}
          paletteId={activeArtist.palette_id}
          iceColor={activeArtist.ice_color}
          amberColor={activeArtist.amber_color}
          name={activeArtist.name}
          size={24}
          className="size-6"
        />
      ) : null}
      {hasUnread && !open ? (
        <span
          aria-label="New reply"
          className="absolute right-0.5 top-0.5 size-2.5 rounded-full bg-amber"
        />
      ) : null}
    </button>
  );
}
