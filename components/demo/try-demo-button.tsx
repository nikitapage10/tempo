"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { focusDemo, seedDemo } from "@/lib/api/demo";
import { armGuidedTour } from "@/lib/guided-tour";

/**
 * "See TEMPO with a demo artist" — builds the PRESIDENT sample workspace and
 * drops the member straight into it.
 *
 * Offered wherever bringing music in is offered, because it answers the same
 * question from the other side: someone who doesn't want to hand over their own
 * catalog before they know what the app does can look at a full one first.
 *
 * The demo is a separate artist, so this never touches whatever they already
 * have — including an Origin they're halfway through.
 */
export function TryDemoButton({
  variant = "secondary",
  size,
  label = "Explore a demo artist",
  className,
  onStarted,
}: {
  variant?: "default" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg";
  label?: string;
  className?: string;
  /** Lets a host flow record the choice before the navigation happens. */
  onStarted?: () => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const result = await seedDemo();
      focusDemo(result);
      // The demo is its own artist, so it gets a complete first-workspace tour
      // even when this member already toured their real workspace.
      armGuidedTour(result.artistId, { force: true });
      onStarted?.();
      // Every cached list is about to describe the wrong artist.
      await queryClient.invalidateQueries();
      // A full load, not a client transition: the workspace gate in the app
      // layout runs on the server and has to re-read which artist comes first.
      window.location.assign("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't build the demo workspace.");
      setBusy(false);
    }
  }

  return (
    <div className={className}>
      <Button type="button" variant={variant} size={size} onClick={start} disabled={busy}>
        <PlayCircle />
        {busy ? "Building the demo…" : label}
      </Button>
      {error ? (
        <p className="mt-2 text-xs text-warn" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
