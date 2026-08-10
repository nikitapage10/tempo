"use client";

import Link from "next/link";
import { usePulseModule } from "@/hooks/use-pulse-items";

/** Today's Pulse module — §8.6. At most 3 rows; hides entirely once caught up. */
export function PulseModule() {
  const { headline, items, caughtUp, isLoading } = usePulseModule();

  if (isLoading || caughtUp) return null;

  return (
    <section className="panel-quiet p-4" aria-label="Pulse">
      <p className="text-sm text-text-hi">{headline}</p>
      <ul className="mt-2 space-y-1.5">
        {items.map((item) => (
          <li key={item.dedupeIdentity}>
            <Link
              href={item.destination}
              className="text-sm text-ice hover:underline"
            >
              {item.genericLabel}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
