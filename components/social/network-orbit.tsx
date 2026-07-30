"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArtistMark } from "@/components/artists/artist-mark";
import { LfWindow } from "@/components/lf-windows";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { SignedImage } from "@/components/ui/signed-image";
import type { Person } from "@/lib/types";
import { cn } from "@/lib/utils";

export type OrbitNode = {
  id: string;
  name: string;
  roles: string[];
  howYouKnow: string;
  handle: string | null;
  emblemUrl: string | null;
  paletteId: string | null;
  iceColor: string | null;
  amberColor: string | null;
  personId: string | null;
  ring: 0 | 1 | 2;
  angle: number;
};

function personToNode(p: Person, ring: 0 | 1 | 2, angle: number): OrbitNode {
  const lp = p.linked_profile;
  return {
    id: p.id,
    name: lp?.display_name ?? p.display_name,
    roles: p.roles.length ? p.roles : [],
    howYouKnow:
      p.source === "collaborator"
        ? "Collaborator on your tracks"
        : p.source === "guest_review"
          ? "Left guest review notes"
          : p.source === "release_credit"
            ? "Credited on a release"
            : p.source === "import"
              ? "From an import"
              : "In your network",
    handle: lp?.handle ?? null,
    emblemUrl: lp?.emblem_url ?? p.avatar_url,
    paletteId: lp?.palette_id ?? null,
    iceColor: lp?.ice_color ?? null,
    amberColor: lp?.amber_color ?? null,
    personId: p.id,
    ring,
    angle,
  };
}

/** Spread people across three rings; linked profiles get the inner rings first. */
export function buildOrbitNodes(people: Person[]): OrbitNode[] {
  const linked = people.filter((p) => p.linked_profile_id);
  const rest = people.filter((p) => !p.linked_profile_id);
  const ordered = [...linked, ...rest].slice(0, 24);
  const rings: Person[][] = [[], [], []];
  ordered.forEach((p, i) => rings[i % 3].push(p));
  const nodes: OrbitNode[] = [];
  rings.forEach((ringPeople, ring) => {
    const n = Math.max(ringPeople.length, 1);
    ringPeople.forEach((p, i) => {
      nodes.push(personToNode(p, ring as 0 | 1 | 2, (i / n) * 360));
    });
  });
  return nodes;
}

/** Pixel radius to the ring midline for each concentric ring. */
const RING_R = [128, 176, 220] as const;
const RING_DUR_S = [42, 58, 76] as const;

type NetworkOrbitProps = {
  people: Person[];
  centerName: string;
  centerEmblemUrl: string | null;
  centerPaletteId: string | null;
  centerIce?: string | null;
  centerAmber?: string | null;
  onOpenPerson: (personId: string) => void;
};

/**
 * Three concentric rings, bottom-anchored. Spectra tokens + CSS keyframes
 * only (no framer-motion). Hover eases rotation via --orbit-speed; icons
 * counter-rotate to stay upright. Respects prefers-reduced-motion and
 * pauses via IntersectionObserver when offscreen.
 */
export function NetworkOrbit({
  people,
  centerName,
  centerEmblemUrl,
  centerPaletteId,
  centerIce,
  centerAmber,
  onOpenPerson,
}: NetworkOrbitProps) {
  const router = useRouter();
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [paused, setPaused] = React.useState(false);
  const [hoverId, setHoverId] = React.useState<string | null>(null);
  const [reduced, setReduced] = React.useState(false);
  const nodes = React.useMemo(() => buildOrbitNodes(people), [people]);

  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  React.useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setPaused(!entry.isIntersecting),
      { threshold: 0.05 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Ease down on hover — never hard-stop (0). Offscreen / reduced → static.
  const speed = reduced || paused ? 0 : hoverId ? 0.22 : 1;
  const spinning = speed > 0;

  return (
    <div
      ref={rootRef}
      className="relative mx-auto h-[20rem] w-full max-w-[32rem] overflow-visible sm:h-[24rem]"
      style={{ ["--orbit-speed" as string]: String(speed) }}
      onMouseLeave={() => setHoverId(null)}
    >
      <div className="absolute bottom-8 left-1/2 size-[27.5rem] max-w-[100vw] -translate-x-1/2 translate-y-[18%]">
        {/* Static ring guides */}
        {[0, 1, 2].map((ring) => (
          <div
            key={`guide-${ring}`}
            className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-line/35"
            style={{ width: RING_R[ring] * 2, height: RING_R[ring] * 2 }}
            aria-hidden
          />
        ))}

        {[0, 1, 2].map((ring) => {
          const dur = `${RING_DUR_S[ring] / Math.max(speed, 0.01)}s`;
          const dirClass = ring === 1 ? "orbit-spin-ccw" : "orbit-spin-cw";
          const counterClass = ring === 1 ? "orbit-spin-cw" : "orbit-spin-ccw";
          return (
            <div
              key={`ring-${ring}`}
              className={cn(
                "absolute left-1/2 top-1/2 size-0",
                spinning && dirClass
              )}
              style={
                spinning
                  ? {
                      animationDuration: dur,
                      animationTimingFunction: "linear",
                      animationIterationCount: "infinite",
                    }
                  : undefined
              }
            >
              {nodes
                .filter((n) => n.ring === ring)
                .map((n) => {
                  const hovered = hoverId === n.id;
                  return (
                    <div
                      key={n.id}
                      className="absolute left-0 top-0"
                      style={{
                        transform: `rotate(${n.angle}deg) translateY(-${RING_R[ring]}px)`,
                      }}
                    >
                      <button
                        type="button"
                        className={cn(
                          "relative flex size-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-bg-1 shadow-e2 transition-[transform,border-color] duration-300 sm:size-11",
                          hovered && "z-20 scale-125 border-ice/50",
                          spinning && !hovered && counterClass
                        )}
                        style={
                          spinning && !hovered
                            ? {
                                animationDuration: dur,
                                animationTimingFunction: "linear",
                                animationIterationCount: "infinite",
                              }
                            : undefined
                        }
                        onMouseEnter={() => setHoverId(n.id)}
                        onFocus={() => setHoverId(n.id)}
                        onClick={() => {
                          if (n.handle) router.push(`/artist/${n.handle}`);
                          else if (n.personId) onOpenPerson(n.personId);
                        }}
                        aria-label={n.name}
                      >
                        {n.emblemUrl ? (
                          <SignedImage
                            path={n.emblemUrl}
                            alt=""
                            className="size-full rounded-full object-cover"
                          />
                        ) : (
                          <ArtistMark
                            emblemUrl={null}
                            paletteId={n.paletteId}
                            iceColor={n.iceColor}
                            amberColor={n.amberColor}
                            name={n.name}
                            size={18}
                          />
                        )}

                        {hovered ? (
                          <span className="absolute left-1/2 top-full z-30 mt-2 w-48 -translate-x-1/2 text-left">
                            <SpotlightCard className="rounded-card border border-line bg-bg-1 p-3 shadow-e3">
                              <p className="truncate text-sm font-medium text-text-hi">
                                {n.name}
                              </p>
                              {n.roles.length ? (
                                <p className="mt-0.5 truncate text-[11px] text-text-lo">
                                  {n.roles.slice(0, 3).join(" · ")}
                                </p>
                              ) : null}
                              <p className="mt-1 text-[11px] text-text-lo">
                                {n.howYouKnow}
                              </p>
                            </SpotlightCard>
                          </span>
                        ) : null}
                      </button>
                    </div>
                  );
                })}
            </div>
          );
        })}

        <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
          <LfWindow className="flex size-16 items-center justify-center overflow-hidden rounded-full border border-line shadow-e3 sm:size-20">
            <div className="relative z-[1] flex size-full items-center justify-center bg-bg-0/35">
              <ArtistMark
                emblemUrl={centerEmblemUrl}
                paletteId={centerPaletteId}
                iceColor={centerIce}
                amberColor={centerAmber}
                name={centerName}
                size={28}
              />
            </div>
          </LfWindow>
        </div>
      </div>
    </div>
  );
}
