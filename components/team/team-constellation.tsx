"use client";

import * as React from "react";
import { motion, useAnimation } from "framer-motion";
import { SignedImage } from "@/components/ui/signed-image";
import { useInView } from "@/hooks/use-in-view";
import { initials } from "@/lib/utils";

export type ConstellationPerson = {
  id: string;
  name: string;
  subtitle?: string;
  avatarUrl?: string | null;
};

/**
 * The team's own shape: the artist at the center, everyone who works with
 * them fanned out on either side. Adapted from a supplied shadcn-registry
 * component onto TEMPO's own tokens (Spectra glass, ice/amber, Jura display
 * type) rather than the generic shadcn theme it shipped with — and onto a
 * native IntersectionObserver hook instead of adding
 * react-intersection-observer for one boolean.
 */
export function TeamConstellation({
  center,
  people,
  onSelectPerson,
}: {
  center: ConstellationPerson;
  people: ConstellationPerson[];
  onSelectPerson?: (id: string) => void;
}) {
  const controls = useAnimation();
  const [ref, inView] = useInView<HTMLDivElement>({ threshold: 0.15, triggerOnce: true });

  React.useEffect(() => {
    if (inView) controls.start("visible");
  }, [inView, controls]);

  const containerVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.08 } },
  };

  const orbitVariants = {
    hidden: { opacity: 0, scale: 0.4, x: 0, y: 0, rotate: 0 },
    visible: (i: number) => {
      const { x, y, rotate } = orbitPosition(i, people.length);
      return {
        opacity: 1,
        scale: 1,
        x,
        y,
        rotate,
        transition: { type: "spring" as const, stiffness: 130, damping: 14 },
      };
    },
  };

  return (
    <div ref={ref} className="relative flex flex-col items-center py-10">
      <motion.div
        className="relative flex items-center justify-center"
        style={{ minHeight: people.length > 0 ? 220 : 120 }}
        variants={containerVariants}
        initial="hidden"
        animate={controls}
      >
        {people.map((person, i) => (
          <motion.button
            key={person.id}
            type="button"
            custom={i}
            variants={orbitVariants}
            style={{ zIndex: people.length - Math.abs(i - (people.length - 1) / 2) }}
            whileHover={{ scale: 1.08, zIndex: 50 }}
            onClick={() => onSelectPerson?.(person.id)}
            className="absolute flex flex-col items-center gap-1.5"
          >
            <Avatar person={person} size={72} ring />
            <span className="max-w-[5.5rem] truncate text-[11px] text-text-lo">
              {person.name}
            </span>
          </motion.button>
        ))}

        {/* Center — the artist. Rendered after the fan so it always sits on top. */}
        <div className="relative z-[60] flex flex-col items-center gap-2">
          <Avatar person={center} size={108} accent />
          <div className="text-center">
            <p className="font-display text-sm font-medium tracking-[0.01em] text-text-hi">
              {center.name}
            </p>
            {center.subtitle ? (
              <p className="label-mono mt-0.5 text-text-lo">{center.subtitle}</p>
            ) : null}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function orbitPosition(index: number, total: number) {
  const centerIndex = (total - 1) / 2;
  const distance = index - centerIndex;
  return {
    x: distance * 96,
    y: Math.abs(distance) * -26,
    rotate: distance * 6,
  };
}

function Avatar({
  person,
  size,
  ring,
  accent,
}: {
  person: ConstellationPerson;
  size: number;
  ring?: boolean;
  accent?: boolean;
}) {
  return (
    <div
      className={
        accent
          ? "prism-edge relative overflow-hidden rounded-full border-2 border-ice/40 bg-bg-2 shadow-e2"
          : ring
            ? "relative overflow-hidden rounded-full border-2 border-bg-0 bg-bg-2 shadow-e1"
            : "relative overflow-hidden rounded-full bg-bg-2"
      }
      style={{ width: size, height: size }}
    >
      <SignedImage
        path={person.avatarUrl}
        alt={person.name}
        className="h-full w-full object-cover"
        fallback={
          <div className="flex h-full w-full items-center justify-center font-display text-text-hi">
            {initials(person.name)}
          </div>
        }
      />
    </div>
  );
}
