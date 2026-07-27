"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useActiveSession, useSessionMutations } from "@/hooks/use-sessions";
import { useTrack } from "@/hooks/use-tracks";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

const STALE_AFTER_SEC = 24 * 60 * 60;

/**
 * Surfaces the signed-in user's one in-progress focus session, with a live
 * elapsed timer. Past 24h it switches to a close-or-resume prompt rather than
 * a plain "continue" (FEATURE-SPECS §10).
 */
export function ActiveSessionBanner({
  excludeTrackId,
}: {
  /** Hide the banner when it's for the track already shown on this page. */
  excludeTrackId?: string;
}) {
  const { data: session } = useActiveSession();
  const trackQuery = useTrack(session?.track_id ?? null);
  const { abandonFocus } = useSessionMutations(session?.track_id ?? null);
  const { toast } = useToast();
  const [elapsed, setElapsed] = React.useState(0);

  React.useEffect(() => {
    if (!session?.started_at) return;
    const start = new Date(session.started_at).getTime();
    const tick = () =>
      setElapsed(Math.max(0, Math.round((Date.now() - start) / 1000)));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [session?.started_at]);

  if (!session || session.track_id === excludeTrackId) return null;

  const track = trackQuery.data;
  const stale = elapsed > STALE_AFTER_SEC;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-card border px-4 py-3",
        stale ? "border-warn/40 bg-warn/5" : "border-ice/30 bg-ice/5"
      )}
    >
      <div className="min-w-0">
        <p className="text-sm text-text-hi">
          Focus session in progress
          {track ? (
            <>
              {" on "}
              <span className="font-medium">{track.title}</span>
            </>
          ) : null}
          {session.goal ? (
            <span className="text-text-lo"> — {session.goal}</span>
          ) : null}
        </p>
        <p className="mt-0.5 font-mono text-[11px] text-text-lo">
          {formatDuration(elapsed)} elapsed
          {stale ? " · this one's been running a while" : ""}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        {stale ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={async () => {
              try {
                await abandonFocus.mutateAsync(session.id);
                toast("Session closed", "ok");
              } catch (err) {
                toast(
                  err instanceof Error
                    ? err.message
                    : "Couldn’t close that session."
                );
              }
            }}
          >
            Close it
          </Button>
        ) : null}
        <Button type="button" size="sm" asChild>
          <Link href={`/track/${session.track_id}/focus`}>Resume</Link>
        </Button>
      </div>
    </div>
  );
}
