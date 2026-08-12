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

export function SceneCard({ scene, href }: { scene: Scene; href?: string }) {
  const { ice, amber } = resolveArtistAccent(scene.palette_id, {
    ice: scene.ice_color,
    amber: scene.amber_color,
  });

  return (
    <SpotlightCard radius={16} className="rounded-panel">
      <Link
        href={href ?? `/scenes/${scene.slug}`}
        className="group block overflow-hidden rounded-panel border border-line bg-bg-1 shadow-e1 transition duration-300 hover:-translate-y-0.5 hover:border-white/15 hover:shadow-e2"
      >
        <div
          className="relative aspect-[2.65/1] min-h-32 w-full overflow-hidden"
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
              alt={scene.banner_alt ?? ""}
              className="size-full object-cover transition duration-700 group-hover:scale-[1.025]"
              style={{ objectPosition: `${scene.banner_focal_x ?? 50}% ${scene.banner_focal_y ?? 50}%` }}
            />
          ) : null}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: `radial-gradient(80% 100% at 8% 10%, color-mix(in srgb, ${ice} 18%, transparent), transparent 60%), radial-gradient(80% 100% at 92% 82%, color-mix(in srgb, ${amber} 15%, transparent), transparent 62%), linear-gradient(to top, rgb(10 10 12 / .82), transparent 66%)`,
            }}
          />
          <div className="scene-hero-grain pointer-events-none absolute inset-0 opacity-[0.06]" />
          {scene.has_unread ? (
            <span
              className="absolute right-3 top-3 size-2 rounded-full bg-ice shadow-[0_0_8px_var(--ice)]"
              aria-hidden
            />
          ) : null}
        </div>
        <div className="flex items-center gap-3 px-4 pt-4">
          <ArtistMark
            emblemUrl={scene.emblem_url}
            paletteId={scene.palette_id}
            iceColor={scene.ice_color}
            amberColor={scene.amber_color}
            name={scene.name}
            size={44}
            className="size-11 shrink-0 shadow-e1"
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
        <div className="flex items-center justify-between px-4 pb-4 pt-3 text-xs text-text-lo">
          <span className="flex items-center gap-1">
            <Users className="size-3" />
            {scene.member_count} {scene.member_count === 1 ? "member" : "members"}
          </span>
          {scene.my_status === "pending" ? (
            <span className={cn("rounded-chip border border-line px-2 py-0.5 text-xs")}>
              Waiting on approval
            </span>
          ) : null}
        </div>
      </Link>
    </SpotlightCard>
  );
}
