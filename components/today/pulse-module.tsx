"use client";

import Link from "next/link";
import { usePulseModule } from "@/hooks/use-pulse-items";
import { cn } from "@/lib/utils";

/** Today's Pulse module — §8.6. At most 3 rows; hides entirely once caught up. */
export function PulseModule({ embedded = false }: { embedded?: boolean }) {
  const { headline, items, caughtUp, isLoading } = usePulseModule();

  if (isLoading || caughtUp) return null;

  return (
    <section
      className={cn(
        embedded
          ? "border-y border-line/60 py-3"
          : "panel-quiet min-h-[72px] px-4 py-4 sm:px-5"
      )}
      aria-label="Pulse"
    >
      <div className="flex items-center gap-2">
        <span
          className="size-1.5 shrink-0 rounded-full bg-ice shadow-[0_0_10px_rgb(127_180_255_/_0.6)]"
          aria-hidden
        />
        <p className="label-mono">Pulse</p>
      </div>
      <p className="mt-2 text-sm text-text-hi">{headline}</p>
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5">
        {items.map((item) => (
          <li key={item.dedupeIdentity}>
            <Link
              href={item.destination}
              className="text-xs text-ice hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
            >
              {item.genericLabel}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
