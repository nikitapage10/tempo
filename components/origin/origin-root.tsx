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

  React.useEffect(() => {
    if (isLoading || !activeArtist) return;
    if (alreadyDone && !revisit && !replay) {
      router.replace(importPending ? "/import" : "/");
    }
  }, [isLoading, activeArtist, alreadyDone, revisit, replay, importPending, router]);

  // Deep black rather than a spinner — Origin opens out of this.
  if (isLoading || !activeArtist || (alreadyDone && !revisit && !replay)) {
    return <div className="fixed inset-0 bg-[var(--bg-0)]" />;
  }

  return (
    <OriginExperience importPending={importPending} revisit={revisit} replay={replay} />
  );
}
