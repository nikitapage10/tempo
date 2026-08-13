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

function cardState(index: number, total: number) {
  const centerIndex = (total - 1) / 2;
  const distance = index - centerIndex;
  return {
    x: distance * 90,
    y: Math.abs(distance) * -30,
    rotate: distance * 12,
  };
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

  const containerVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.1 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, scale: 0.5, x: 0, y: 0, rotate: 0 },
    visible: (i: number) => {
      const { x, y, rotate } = cardState(i, people.length);
      return {
        opacity: 1,
        scale: 1,
        x,
        y,
        rotate,
        transition: { type: "spring" as const, stiffness: 120, damping: 12 },
      };
    },
  };

  return (
    <div ref={ref} className={cn("flex flex-col items-center px-4 py-10 text-center", className)}>
      {title ? (
        <h2 className="font-display text-2xl font-semibold tracking-tight text-text-hi sm:text-4xl">
          {title}
        </h2>
      ) : null}
      {description ? (
        <p className="mt-2 max-w-2xl text-sm text-text-lo sm:text-base">{description}</p>
      ) : null}

      <motion.div
        className="relative mt-16 flex items-center justify-center"
        style={{ minHeight: people.length > 0 ? 250 : 120 }}
        variants={containerVariants}
        initial="hidden"
        animate={controls}
      >
        {people.map((person, i) => (
          <motion.button
            key={person.id}
            type="button"
            custom={i}
            variants={itemVariants}
            style={{
              zIndex:
                people.length - Math.abs(i - (people.length - 1) / 2) + (person.featured ? 8 : 0),
            }}
            whileHover={{
              scale: 1.1,
              zIndex: 99,
              transition: { type: "spring", stiffness: 300, damping: 20 },
            }}
            onClick={() => onSelectPerson?.(person.id)}
            className="absolute flex flex-col items-center gap-1.5"
          >
            <div
              className={cn(
                "overflow-hidden rounded-xl border-2 bg-bg-2 shadow-e2",
                person.featured
                  ? "h-32 w-32 border-ice/40 md:h-40 md:w-40 lg:h-44 lg:w-44"
                  : "h-28 w-28 border-bg-0 md:h-36 md:w-36 lg:h-40 lg:w-40"
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
            <span className="max-w-[7rem] truncate text-[11px] text-text-hi">{person.name}</span>
            {person.subtitle ? (
              <span className="label-mono max-w-[7rem] truncate text-text-lo">
                {person.subtitle}
              </span>
            ) : null}
          </motion.button>
        ))}
      </motion.div>
    </div>
  );
}
