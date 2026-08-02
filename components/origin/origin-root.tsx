"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useActiveArtist } from "@/components/active-artist-provider";
import { OriginExperience } from "@/components/origin/origin-experience";

/**
 * Guards the ORIGIN route.
 *
 * An artist that has already finished (or predates the feature) is sent on
 * rather than dropped back into onboarding — unless they asked for it, via the
 * deliberate "Artist Origin" action in Settings.
 */
export function OriginRoot({
  importPending,
  revisit,
  replay,
}: {
  importPending: boolean;
  revisit: boolean;
  /** Deliberate "Replay introduction" — runs the whole film from the top. */
  replay: boolean;
}) {
  const router = useRouter();
  const { activeArtist, isLoading } = useActiveArtist() as {
    activeArtist: { id: string; origin_status?: string | null } | null;
    isLoading: boolean;
  };

  const status = activeArtist?.origin_status ?? null;
  // `null` means migration 042 hasn't run. Treated as done: an un-migrated
  // database must never trap anyone in an onboarding flow that cannot save.
  const alreadyDone =
    status === null ||
    status === "complete" ||
    status === "legacy_complete" ||
    status === "skipped";

  /**
   * Frozen at first read, deliberately not kept live.
   *
   * This guard exists for one moment only: an artist *arriving* at /origin
   * already finished should bounce straight out. Reading `alreadyDone` on
   * every render instead made it fire a second time mid-flow — the artist's
   * own "Enter TEMPO" click completes origin_status through the same
   * `activeArtist` query this reads, and that update lands *while*
   * `handleEnter` is still running, before its own `router.replace("/")`.
   * This effect would see the flip and race it with a second navigation of
   * its own — one built from `importPending`, a prop frozen at page load
   * that goes stale the moment Import runs inside the story, so it could
   * send the artist to /import while handleEnter was headed to /. Whichever
   * one landed second cut the arrival reveal off mid-animation.
   *
   * A guard that only ever acts on the *arrival* snapshot can't race a
   * completion that happens after that snapshot was taken.
   */
  const alreadyDoneAtArrivalRef = React.useRef<boolean | null>(null);
  if (!isLoading && activeArtist && alreadyDoneAtArrivalRef.current === null) {
    alreadyDoneAtArrivalRef.current = alreadyDone;
  }
  const alreadyDoneAtArrival = alreadyDoneAtArrivalRef.current ?? false;

  React.useEffect(() => {
    if (isLoading || !activeArtist) return;
    if (alreadyDoneAtArrival && !revisit && !replay) {
      router.replace(importPending ? "/import" : "/");
    }
    // alreadyDoneAtArrival is a ref snapshot, not state — re-running this
    // effect when it "changes" would defeat the point of freezing it. The
    // other deps are enough to catch the one real transition this guards:
    // isLoading -> false with an artist finally in hand.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, activeArtist, revisit, replay, importPending, router]);

  // Deep black rather than a spinner — Origin opens out of this.
  if (isLoading || !activeArtist || (alreadyDoneAtArrival && !revisit && !replay)) {
    return <div className="fixed inset-0 bg-[var(--bg-0)]" />;
  }

  return (
    <OriginExperience importPending={importPending} revisit={revisit} replay={replay} />
  );
}
