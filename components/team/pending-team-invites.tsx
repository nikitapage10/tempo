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
import { AREA_KEYS, AREA_LABELS, areaLevel } from "@/lib/team/areas";
import { errorMessage, initials } from "@/lib/utils";

/** Invites from artists this Pro has not approved yet. */
export function PendingTeamInvites() {
  const { data: invites = [], isLoading } = usePendingTeamInvites();
  const respond = useRespondToTeamInvite();
  const { toast } = useToast();
  const [reviewing, setReviewing] = React.useState<string | null>(null);

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
          <li key={invite.id} className="panel-quiet p-3">
            <div className="flex items-center gap-3">
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
                Join as {invite.relationshipLabel || ROLE_LABELS[invite.role]}
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
                disabled={respond.isPending || reviewing !== invite.id}
                onClick={() => void handle(invite.id, true)}
              >
                Approve
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setReviewing((id) => id === invite.id ? null : invite.id)}>
                {reviewing === invite.id ? "Hide access" : "Review access"}
              </Button>
            </div>
            </div>
            {reviewing === invite.id ? (
              <div className="mt-3 border-t border-line/50 pt-3">
                {invite.inviteMessage ? <p className="mb-3 text-sm text-text-hi">{invite.inviteMessage}</p> : null}
                <p className="label-mono mb-2">What you can access</p>
                <dl className="grid gap-2 sm:grid-cols-2">
                  {AREA_KEYS.map((area) => <div key={area} className="flex justify-between gap-3 text-xs"><dt className="text-text-lo">{AREA_LABELS[area]}</dt><dd className="capitalize text-text-hi">{areaLevel(invite.areas, area)}</dd></div>)}
                </dl>
                <p className="mt-3 text-xs text-text-lo">Approval accepts this exact access summary. The artist can change it later, and you can leave the team at any time.</p>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
