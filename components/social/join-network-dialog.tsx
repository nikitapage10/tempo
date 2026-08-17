"use client";

import * as React from "react";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { HandleField, type HandleState } from "@/components/social/handle-field";
import { useArtistProfile } from "@/hooks/use-artist-profile";
import { suggestHandle } from "@/lib/social/handle";

/**
 * Joining the network, asked properly.
 *
 * Every way onto the network goes through this: Social's empty state, the
 * Artist page's visibility control, and the choice offered during onboarding.
 * They all need the same thing first, which is a handle, so the question lives
 * in one dialog rather than being asked slightly differently in three places.
 */
export function JoinNetworkDialog({
  open,
  onOpenChange,
  artistId,
  artistName,
  currentHandle,
  visibility = "members",
  onJoined,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  artistId: string | null;
  /** Seeds a suggested handle so most people only have to approve one. */
  artistName?: string | null;
  currentHandle?: string | null;
  visibility?: "members" | "public";
  onJoined?: () => void;
}) {
  const { publish } = useArtistProfile(artistId);
  const [handle, setHandle] = React.useState("");
  const [state, setState] = React.useState<HandleState>({ value: "", ready: false });
  const [error, setError] = React.useState<string | null>(null);

  // Reset each time it opens: a handle abandoned last time should not be
  // sitting in the field, already checked, waiting to be submitted by habit.
  React.useEffect(() => {
    if (!open) return;
    setHandle(currentHandle ?? suggestHandle(artistName));
    setError(null);
  }, [open, currentHandle, artistName]);

  async function join() {
    if (!state.ready || !state.value) return;
    setError(null);
    try {
      await publish.mutateAsync({
        visibility,
        handle: state.value,
        displayName: artistName ?? undefined,
      });
      onOpenChange(false);
      onJoined?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t join the network.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Join the network"
        description={
          visibility === "public"
            ? "Your page becomes visible to TEMPO members and shareable with anyone who has the link."
            : "Your page becomes visible to other TEMPO members. Nothing in your workspace is shared, only the profile you shape."
        }
        onClose={() => onOpenChange(false)}
      >
        <div className="flex flex-col gap-4">
          <HandleField
            value={handle}
            onChange={setHandle}
            onStateChange={setState}
            currentArtistId={artistId ?? undefined}
            currentHandle={currentHandle}
            autoFocus
            disabled={publish.isPending}
          />
          {error ? (
            <p role="alert" className="text-xs text-warn">
              {error}
            </p>
          ) : null}
          <p className="text-xs leading-relaxed text-text-lo/80">
            You can leave the network at any time from your Profile page, and
            your work stays exactly where it is either way.
          </p>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Not now
          </Button>
          <Button
            type="button"
            disabled={!state.ready || publish.isPending}
            onClick={() => void join()}
          >
            <Users className="size-3.5" />
            {publish.isPending ? "Joining…" : "Join the network"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
