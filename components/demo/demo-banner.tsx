"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useActiveArtist } from "@/components/active-artist-provider";
import { forgetDemo, removeDemoWorkspace } from "@/lib/api/demo";

/**
 * The strip that sits above the workspace whenever the demo artist is the one
 * being viewed.
 *
 * It exists to answer two questions at all times: is any of this real, and how
 * do I get rid of it. Both matter more than the space it costs — someone who
 * can't tell sample data from their own catalog will not trust either.
 */
export function DemoBanner() {
  const { activeArtist } = useActiveArtist();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const demoKind = activeArtist?.demo_kind ?? null;
  if (!demoKind) return null;

  async function remove() {
    if (!activeArtist) return;
    setBusy(true);
    setError(null);
    try {
      await removeDemoWorkspace(activeArtist.id);
      forgetDemo();
      queryClient.clear();
      // A hard load rather than a router push. The artist this page is built
      // around no longer exists, and the server-side workspace gate needs to
      // re-run — for anyone who started the demo partway through Origin, that
      // gate is what puts them back where they left off.
      window.location.assign("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove the demo.");
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <>
      <div
        role="status"
        className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-amber/30 bg-amber/5 px-4 py-3"
      >
        <div className="min-w-0">
          <p className="text-sm font-medium text-text-hi">
            You&rsquo;re exploring a demo workspace
          </p>
          <p className="mt-0.5 text-xs text-text-lo">
            Sample data for {activeArtist?.name}, built so you can see TEMPO with a
            real catalog in it. None of it is yours, and nothing here touches your
            own work. Remove it whenever you&rsquo;re done looking.
          </p>
          {error ? (
            <p className="mt-1 text-xs text-warn" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setConfirming(true)}
          disabled={busy}
        >
          {busy ? "Removing…" : "Remove demo data"}
        </Button>
      </div>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Remove the demo workspace?"
        description={
          "Everything in the demo goes: its tracks, projects, tasks, sessions, feedback and artist profile. Your own artist and anything you've made is untouched, and if you hadn't finished setting yours up yet, you'll pick up exactly where you left off."
        }
        confirmLabel="Remove demo data"
        busy={busy}
        onConfirm={remove}
      />
    </>
  );
}
