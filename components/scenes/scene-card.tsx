"use client";

import Link from "next/link";
import { Users } from "lucide-react";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { SignedImage } from "@/components/ui/signed-image";
import { ArtistMark } from "@/components/artists/artist-mark";
import { resolveArtistAccent } from "@/lib/artist-theme";
import type { Scene } from "@/lib/types";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<Scene["kind"], string> = {
  label: "Label",
  school: "School",
  crew: "Crew",
  collective: "Collective",
  genre: "Genre",
  local: "Local",
  other: "Scene",
};

export function SceneCard({ scene }: { scene: Scene }) {
  const { ice, amber } = resolveArtistAccent(scene.palette_id, {
    ice: scene.ice_color,
    amber: scene.amber_color,
  });

  return (
    <SpotlightCard radius={16} className="rounded-panel">
      <Link
        href={`/scenes/${scene.slug}`}
        className="block overflow-hidden rounded-panel border border-line bg-bg-1 shadow-e1"
      >
        <div
          className="relative h-20 w-full"
          style={
            scene.banner_url
              ? undefined
              : {
                  background: `linear-gradient(135deg, color-mix(in srgb, ${ice} 30%, transparent), color-mix(in srgb, ${amber} 22%, transparent))`,
                }
          }
        >
          {scene.banner_url ? (
            <SignedImage
              path={scene.banner_url}
              alt=""
              className="size-full object-cover"
            />
          ) : null}
          {scene.has_unread ? (
            <span
              className="absolute right-3 top-3 size-2 rounded-full bg-ice shadow-[0_0_8px_var(--ice)]"
              aria-hidden
            />
          ) : null}
        </div>
        <div className="flex items-start gap-3 p-4">
          <ArtistMark
            emblemUrl={scene.emblem_url}
            paletteId={scene.palette_id}
            iceColor={scene.ice_color}
            amberColor={scene.amber_color}
            name={scene.name}
            size={36}
            className="-mt-8 size-9 border-2 border-bg-1 bg-bg-1"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-sm font-semibold text-text-hi">
              {scene.name}
            </p>
            <p className="truncate text-xs text-text-lo">
              {scene.tagline || KIND_LABEL[scene.kind]}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between px-4 pb-4 text-xs text-text-lo">
          <span className="flex items-center gap-1">
            <Users className="size-3" />
            {scene.member_count} {scene.member_count === 1 ? "member" : "members"}
          </span>
          {scene.my_status === "pending" ? (
            <span className={cn("rounded-chip border border-line px-2 py-0.5 text-[11px]")}>
              Waiting on approval
            </span>
          ) : null}
        </div>
      </Link>
    </SpotlightCard>
  );
}
