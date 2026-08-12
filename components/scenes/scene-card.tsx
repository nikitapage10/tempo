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
    <SpotlightCard
      radius={16}
      className={cn(
        "rounded-panel shadow-e1",
        "transition-[transform,box-shadow] duration-300 ease-out",
        "hover:-translate-y-0.5 hover:shadow-e2",
        "motion-reduce:transition-none motion-reduce:hover:translate-y-0"
      )}
    >
      {/* Lift stays on SpotlightCard. Overflow+radius clip stays on the Link
          only — putting both transform and overflow:hidden on one node makes
          Chromium flash square corners for a frame. */}
      <Link
        href={href ?? `/scenes/${scene.slug}`}
        className="group relative block overflow-hidden rounded-panel border border-line/80 transition-colors duration-300 hover:border-white/15"
      >
        {/* Banner fills the whole card so glass frosts real artwork — no seam
            where a short image box ends above the footer. */}
        <div
          className="relative aspect-[1.55/1] min-h-[220px] w-full"
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
              className="absolute inset-0 size-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.025] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
              style={{
                objectPosition: `${scene.banner_focal_x ?? 50}% ${scene.banner_focal_y ?? 50}%`,
              }}
            />
          ) : null}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: `radial-gradient(80% 100% at 8% 10%, color-mix(in srgb, ${ice} 18%, transparent), transparent 60%), radial-gradient(80% 100% at 92% 82%, color-mix(in srgb, ${amber} 15%, transparent), transparent 62%)`,
            }}
          />
          <div className="scene-hero-grain pointer-events-none absolute inset-0 opacity-[0.06]" />
          {scene.has_unread ? (
            <span
              className="absolute right-3 top-3 z-10 size-2 rounded-full bg-ice shadow-[0_0_8px_var(--ice)]"
              aria-hidden
            />
          ) : null}

          {/* Glass footer flush to the card bottom — artwork continues behind. */}
          <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,rgb(10_10_12/0.15)_0%,rgb(10_10_12/0.55)_28%,rgb(10_10_12/0.72)_100%)] px-4 pb-4 pt-8 backdrop-blur-xl">
            <div className="flex items-center gap-3">
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
            <div className="mt-3 flex items-center justify-between text-xs text-text-lo">
              <span className="flex items-center gap-1">
                <Users className="size-3" />
                {scene.member_count}{" "}
                {scene.member_count === 1 ? "member" : "members"}
              </span>
              {scene.my_status === "pending" ? (
                <span
                  className={cn(
                    "rounded-chip border border-line/70 bg-bg-1/40 px-2 py-0.5 text-xs backdrop-blur-sm"
                  )}
                >
                  Waiting on approval
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </Link>
    </SpotlightCard>
  );
}
