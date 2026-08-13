"use client";

import * as React from "react";
import { motion, useAnimation } from "framer-motion";
import { SignedImage } from "@/components/ui/signed-image";
import { useInView } from "@/hooks/use-in-view";
import { cn, initials } from "@/lib/utils";

export type ConstellationPerson = {
  id: string;
  name: string;
  subtitle?: string;
  avatarUrl?: string | null;
  featured?: boolean;
};

export type FanPose = {
  x: number;
  y: number;
  rotate: number;
  zIndex: number;
};

/**
 * Artist sits at the center, in front. Members fan left/right behind.
 */
export function teamFanPose(featured: boolean, memberIndex: number): FanPose {
  if (featured) {
    return { x: 0, y: 6, rotate: 0, zIndex: 40 };
  }
  const side = memberIndex % 2 === 0 ? -1 : 1;
  const rank = Math.floor(memberIndex / 2) + 1;
  return {
    x: side * rank * 220,
    y: rank * 18,
    rotate: side * rank * 8,
    zIndex: 12 - rank,
  };
}

/** Stage height grows with how many people sit behind the artist — not a fixed empty slab. */
export function teamFanStageMinHeight(memberCount: number): number {
  const ranks = Math.max(0, Math.ceil(Math.max(0, memberCount) / 2));
  return 400 + ranks * 28;
}

/**
 * Rectangular photo cards fanned from the center. Adapted from a supplied
 * shadcn-registry component onto TEMPO tokens, using the native
 * IntersectionObserver hook instead of adding react-intersection-observer.
 */
export function TeamConstellation({
  title,
  description,
  people,
  onSelectPerson,
  className,
}: {
  title?: string;
  description?: string;
  people: ConstellationPerson[];
  onSelectPerson?: (id: string) => void;
  className?: string;
}) {
  const controls = useAnimation();
  const [ref, inView] = useInView<HTMLDivElement>({ threshold: 0.15, triggerOnce: true });

  React.useEffect(() => {
    if (inView) controls.start("visible");
  }, [inView, controls]);

  const memberIndexById = React.useMemo(() => {
    const map = new Map<string, number>();
    let n = 0;
    for (const person of people) {
      if (person.featured) continue;
      map.set(person.id, n);
      n += 1;
    }
    return map;
  }, [people]);

  // Paint members first so the artist card wins even if z-index is ignored.
  const paintOrder = React.useMemo(
    () => [...people.filter((p) => !p.featured), ...people.filter((p) => p.featured)],
    [people]
  );

  const containerVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.1 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, scale: 0.92, x: 0, y: 0, rotate: 0 },
    visible: (person: ConstellationPerson) => {
      const { x, y, rotate } = teamFanPose(
        !!person.featured,
        memberIndexById.get(person.id) ?? 0
      );
      return {
        opacity: 1,
        scale: person.featured ? 1.06 : 1,
        x,
        y,
        rotate,
        transition: { type: "spring" as const, stiffness: 120, damping: 12 },
      };
    },
  };

  return (
    <div ref={ref} className={cn("flex flex-col items-center px-4 py-5 text-center", className)}>
      {title ? (
        <h2 className="font-display text-xl font-semibold tracking-tight text-text-hi sm:text-2xl">
          {title}
        </h2>
      ) : null}
      {description ? (
        <p className="mt-1 max-w-xl text-sm text-text-lo">{description}</p>
      ) : null}

      <motion.div
        className="relative mt-6 flex items-center justify-center"
        style={{
          minHeight:
            people.length > 0
              ? teamFanStageMinHeight(people.filter((p) => !p.featured).length)
              : 120,
        }}
        variants={containerVariants}
        initial="hidden"
        animate={controls}
      >
        {paintOrder.map((person) => {
          const pose = teamFanPose(!!person.featured, memberIndexById.get(person.id) ?? 0);
          return (
            <motion.button
              key={person.id}
              type="button"
              custom={person}
              variants={itemVariants}
              style={{ zIndex: pose.zIndex }}
              whileHover={{
                scale: 1.1,
                zIndex: 99,
                transition: { type: "spring", stiffness: 300, damping: 20 },
              }}
              onClick={() => onSelectPerson?.(person.id)}
              className="absolute flex flex-col items-center gap-2"
            >
              <div
                className={cn(
                  "overflow-hidden rounded-xl border-2 bg-bg-2 shadow-e2",
                  person.featured
                    ? "h-64 w-64 border-ice/40 sm:h-72 sm:w-72 md:h-80 md:w-80"
                    : "h-48 w-48 border-bg-0 sm:h-56 sm:w-56 md:h-64 md:w-64"
                )}
              >
                <SignedImage
                  path={person.avatarUrl}
                  alt={person.name}
                  className="h-full w-full object-cover"
                  fallback={
                    <div className="flex h-full w-full items-center justify-center font-display text-lg text-text-hi">
                      {initials(person.name)}
                    </div>
                  }
                />
              </div>
              <span
                className={cn(
                  "max-w-[16rem] truncate text-text-hi",
                  person.featured ? "text-base sm:text-lg" : "text-sm sm:text-base"
                )}
              >
                {person.name}
              </span>
              {person.subtitle ? (
                <span className="label-mono max-w-[11rem] truncate text-text-lo">
                  {person.subtitle}
                </span>
              ) : null}
            </motion.button>
          );
        })}
      </motion.div>
    </div>
  );
}
