"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { SignedImage } from "@/components/ui/signed-image";
import { useToast } from "@/components/ui/toast";
import {
  usePendingTeamInvites,
  useRespondToTeamInvite,
} from "@/hooks/use-artist-members";
import { ROLE_LABELS } from "@/lib/team/roles";
import { errorMessage, initials } from "@/lib/utils";

/** Invites from artists this Pro has not approved yet. */
export function PendingTeamInvites() {
  const { data: invites = [], isLoading } = usePendingTeamInvites();
  const respond = useRespondToTeamInvite();
  const { toast } = useToast();

  if (isLoading || invites.length === 0) return null;

  async function handle(memberId: string, accept: boolean) {
    try {
      await respond.mutateAsync({ memberId, accept });
      toast(accept ? "You’re on that team." : "Invite declined.", "ok");
    } catch (err) {
      toast(errorMessage(err, "Couldn’t update that invite."));
    }
  }

  return (
    <section className="space-y-2">
      <p className="label-mono">Waiting on you ({invites.length})</p>
      <ul className="space-y-2">
        {invites.map((invite) => (
          <li key={invite.id} className="panel-quiet flex items-center gap-3 p-3">
            <div className="size-10 shrink-0 overflow-hidden rounded-xl border border-line bg-bg-2">
              <SignedImage
                path={invite.artistEmblemUrl}
                alt={invite.artistName}
                className="h-full w-full object-cover"
                fallback={
                  <div className="flex h-full w-full items-center justify-center font-display text-text-hi">
                    {initials(invite.artistName)}
                  </div>
                }
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-text-hi">{invite.artistName}</p>
              <p className="text-xs text-text-lo">
                Join as {ROLE_LABELS[invite.role]}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={respond.isPending}
                onClick={() => void handle(invite.id, false)}
              >
                Decline
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={respond.isPending}
                onClick={() => void handle(invite.id, true)}
              >
                Approve
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
