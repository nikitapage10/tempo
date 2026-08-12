"use client";

import { MapPin, Users } from "lucide-react";
import { ArtistMark } from "@/components/artists/artist-mark";
import { SceneThemeScope } from "@/components/scenes/scene-theme-scope";
import { SignedImage } from "@/components/ui/signed-image";
import type { Scene } from "@/lib/types";

const KIND_LABEL: Record<Scene["kind"], string> = {
  label: "Label",
  school: "School",
  crew: "Crew",
  collective: "Collective",
  genre: "Genre",
  local: "Local scene",
  other: "Scene",
};

function Identity({ scene, compact = false }: { scene: Scene; compact?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-3 sm:gap-4">
      <ArtistMark
        emblemUrl={scene.emblem_url}
        paletteId={scene.palette_id}
        iceColor={scene.ice_color}
        amberColor={scene.amber_color}
        name={scene.name}
        size={compact ? 56 : 72}
        className={compact ? "size-14 shrink-0 shadow-e2" : "size-[72px] shrink-0 shadow-e2"}
      />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="truncate font-display text-xl font-semibold tracking-tight text-text-hi sm:text-3xl">
            {scene.name}
          </h1>
          <span className="rounded-chip border border-white/15 bg-black/25 px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.12em] text-white/70 backdrop-blur-sm">
            {KIND_LABEL[scene.kind]}
          </span>
        </div>
        {scene.tagline ? (
          <p className="mt-1 line-clamp-2 max-w-2xl text-sm text-white/75 sm:text-base">
            {scene.tagline}
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/60">
          <span className="inline-flex items-center gap-1.5">
            <Users className="size-3.5" />
            {scene.member_count.toLocaleString()} {scene.member_count === 1 ? "member" : "members"}
          </span>
          {scene.location ? (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-3.5" />
              {scene.location}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
export function SceneHero({ scene, actions }: { scene: Scene; actions?: React.ReactNode }) {
  const focalX = scene.banner_focal_x ?? 50;
  const focalY = scene.banner_focal_y ?? 50;
  const treatment = scene.banner_treatment ?? "wash";
  const overlay =
    treatment === "clean"
      ? "linear-gradient(to top, rgb(10 10 12 / .9), transparent 62%)"
      : treatment === "cinematic"
        ? "radial-gradient(80% 90% at 12% 15%, color-mix(in srgb, var(--ice) 22%, transparent), transparent 60%), radial-gradient(80% 95% at 90% 80%, color-mix(in srgb, var(--amber) 18%, transparent), transparent 60%), linear-gradient(to top, rgb(10 10 12 / .98), rgb(10 10 12 / .25) 58%, rgb(10 10 12 / .08))"
        : "radial-gradient(85% 100% at 8% 12%, color-mix(in srgb, var(--ice) 18%, transparent), transparent 58%), radial-gradient(80% 100% at 92% 80%, color-mix(in srgb, var(--amber) 15%, transparent), transparent 62%), linear-gradient(to top, rgb(10 10 12 / .96), rgb(10 10 12 / .18) 62%, transparent)";

  return (
    <SceneThemeScope scene={scene} className="relative overflow-hidden rounded-panel border border-line shadow-e2">
      <div className="relative h-44 overflow-hidden sm:h-[clamp(260px,24vw,360px)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,color-mix(in_srgb,var(--ice)_32%,transparent),transparent_48%),radial-gradient(circle_at_82%_35%,color-mix(in_srgb,var(--amber)_25%,transparent),transparent_52%),linear-gradient(135deg,var(--bg-2),var(--bg-0))]" />
        {scene.banner_url ? (
          <SignedImage
            path={scene.banner_url}
            alt={scene.banner_alt ?? ""}
            className="absolute inset-0 size-full"
            style={{ objectPosition: `${focalX}% ${focalY}%` }}
          />
        ) : null}
        <div className="pointer-events-none absolute inset-0" style={{ background: overlay }} />
        <div className="scene-hero-grain pointer-events-none absolute inset-0 opacity-[0.075]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        <div className="absolute right-4 top-4 z-10 hidden items-center gap-2 sm:flex">{actions}</div>
        <div className="absolute inset-x-0 bottom-0 z-10 hidden p-6 sm:block lg:p-8">
          <Identity scene={scene} />
        </div>
      </div>
      <div className="relative bg-[linear-gradient(180deg,color-mix(in_srgb,var(--bg-1)_96%,var(--ice)_4%),var(--bg-1))] p-4 sm:hidden">
        <Identity scene={scene} compact />
        {actions ? <div className="mt-4 flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </SceneThemeScope>
  );
}
