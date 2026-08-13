"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useActiveArtist } from "@/components/active-artist-provider";
import { useCurrentUser } from "@/hooks/use-current-user";
import { pickOriginArtistId } from "@/lib/auth/origin-gate";
import { OriginExperience } from "@/components/origin/origin-experience";

/**
 * Guards the ORIGIN route.
 *
 * An artist that has already finished (or predates the feature) is sent on
 * rather than dropped back into onboarding — unless they asked for it, via the
 * deliberate "Artist Origin" action in Settings.
 *
 * A team member who just redeemed an artist invite may still have their
 * manager home selected. Origin must switch to the unfinished music artist
 * instead of treating the personal workspace as "already done."
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
  const user = useCurrentUser();
  const { artists, activeArtist, setActiveArtistId, isLoading } = useActiveArtist();
  const originArtistId = pickOriginArtistId(artists, user?.id);
  const originArtist =
    artists.find((row) => row.id === originArtistId) ??
    (originArtistId ? null : activeArtist);
  const waitingForUser = user === undefined;
  const waitingForOriginArtist =
    !!originArtistId && activeArtist?.id !== originArtistId;

  React.useEffect(() => {
    if (waitingForUser || !originArtistId) return;
    if (activeArtist?.id === originArtistId) return;
    setActiveArtistId(originArtistId);
  }, [waitingForUser, originArtistId, activeArtist?.id, setActiveArtistId]);

  const status = originArtist?.origin_status ?? null;
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
  if (
    !isLoading &&
    !waitingForUser &&
    originArtist &&
    !waitingForOriginArtist &&
    alreadyDoneAtArrivalRef.current === null
  ) {
    alreadyDoneAtArrivalRef.current = alreadyDone;
  }
  const alreadyDoneAtArrival = alreadyDoneAtArrivalRef.current ?? false;

  React.useEffect(() => {
    if (isLoading || waitingForUser || !originArtist || waitingForOriginArtist) return;
    if (alreadyDoneAtArrival && !revisit && !replay) {
      router.replace(importPending ? "/import" : "/");
    }
    // alreadyDoneAtArrival is a ref snapshot, not state — re-running this
    // effect when it "changes" would defeat the point of freezing it. The
    // other deps are enough to catch the one real transition this guards:
    // isLoading -> false with an artist finally in hand.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isLoading,
    waitingForUser,
    originArtist,
    waitingForOriginArtist,
    revisit,
    replay,
    importPending,
    router,
  ]);

  // Deep black rather than a spinner — Origin opens out of this.
  if (
    isLoading ||
    waitingForUser ||
    waitingForOriginArtist ||
    !originArtist ||
    (alreadyDoneAtArrival && !revisit && !replay)
  ) {
    return <div className="fixed inset-0 bg-[var(--bg-0)]" />;
  }

  return (
    <OriginExperience importPending={importPending} revisit={revisit} replay={replay} />
  );
}
