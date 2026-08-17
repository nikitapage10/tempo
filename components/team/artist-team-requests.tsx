"use client";

import * as React from "react";
import { ArtistMark } from "@/components/artists/artist-mark";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { useArtistTeamRequests, useTeamRequestMutations } from "@/hooks/use-team-requests";
import type { ArtistTeamRequest } from "@/lib/api/team-requests";
import { AREA_DESCRIPTIONS, AREA_KEYS, AREA_LABELS, areaLevel, type AreaGrants } from "@/lib/team/areas";
import { MEMBER_ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS, presetForRole, type MemberRole } from "@/lib/team/roles";
import { cn, errorMessage } from "@/lib/utils";

const LEVELS = ["none", "read", "write"] as const;

export function ArtistTeamRequests({ artistId }: { artistId: string }) {
  const requests = useArtistTeamRequests(artistId);
  const mutations = useTeamRequestMutations(artistId);
  const { toast } = useToast();

  async function decline(id: string) {
    try {
      await mutations.respond.mutateAsync({ id, action: "decline" });
      toast("Request declined. No access was shared.", "ok");
    } catch (error) {
      toast(errorMessage(error, "Couldn’t decline that request."));
    }
  }

  if (requests.isLoading || (requests.data ?? []).length === 0) return null;

  return (
    <section className="space-y-3">
      <div>
        <p className="label-mono text-amber">Team requests ({requests.data!.length})</p>
        <p className="mt-1 text-sm text-text-lo">Pros who asked to work with this artist. A request never grants access.</p>
      </div>
      <ul className="space-y-2">
        {requests.data!.map((request) => (
          <RequestCard
            key={request.id}
            request={request}
            pending={mutations.respond.isPending}
            onDecline={() => void decline(request.id)}
            onInvite={async (role, areas, inviteMessage) => {
              try {
                await mutations.respond.mutateAsync({ id: request.id, action: "invite", role, areas, inviteMessage });
                toast("Invitation sent. They’ll review the exact access before joining.", "ok");
              } catch (error) {
                toast(errorMessage(error, "Couldn’t send that invitation."));
              }
            }}
          />
        ))}
      </ul>
    </section>
  );
}

function RequestCard({
  request,
  pending,
  onDecline,
  onInvite,
}: {
  request: ArtistTeamRequest;
  pending: boolean;
  onDecline: () => void;
  onInvite: (role: MemberRole, areas: AreaGrants, inviteMessage: string) => Promise<void>;
}) {
  const [reviewing, setReviewing] = React.useState(false);
  const [role, setRole] = React.useState<MemberRole>(request.requestedRole);
  const [areas, setAreas] = React.useState<AreaGrants>(() => presetForRole(request.requestedRole));
  const [inviteMessage, setInviteMessage] = React.useState("");
  const profile = request.requester;

  return (
    <li className="panel-quiet p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <ArtistMark emblemUrl={profile?.emblem_url ?? null} paletteId={profile?.palette_id} iceColor={profile?.ice_color} amberColor={profile?.amber_color} name={profile?.display_name ?? "Pro"} size={40} className="size-10" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-text-hi">{profile?.display_name ?? "TEMPO Pro"}</p>
          <p className="text-xs text-text-lo">Requested: {ROLE_LABELS[request.requestedRole]}{profile?.handle ? ` · @${profile.handle}` : ""}</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={onDecline}>Decline</Button>
          <Button type="button" size="sm" onClick={() => setReviewing((value) => !value)}>{reviewing ? "Close review" : "Review request"}</Button>
        </div>
      </div>

      {reviewing ? (
        <div className="mt-3 space-y-3 border-t border-line/60 pt-3">
          {request.note ? <div className="well p-3"><p className="label-mono mb-1">Their note</p><p className="text-sm text-text-hi">{request.note}</p></div> : null}
          <div>
            <label className="label-mono mb-1 block" htmlFor={`team-request-role-${request.id}`}>Role to offer</label>
            <select
              id={`team-request-role-${request.id}`}
              value={role}
              onChange={(event) => { const next = event.target.value as MemberRole; setRole(next); setAreas(presetForRole(next)); }}
              className="h-9 w-full rounded-input border border-line bg-bg-2 px-2.5 text-sm text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
            >
              {MEMBER_ROLES.map((item) => <option key={item} value={item}>{ROLE_LABELS[item]}</option>)}
            </select>
            <p className="mt-1 text-xs text-text-lo">{ROLE_DESCRIPTIONS[role]}</p>
          </div>
          <div className="space-y-2">
            <p className="label-mono">Exact access in the invitation</p>
            {AREA_KEYS.map((area) => (
              <div key={area} className="flex flex-col gap-2 border-b border-line/40 pb-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0"><p className="text-xs text-text-hi">{AREA_LABELS[area]}</p><p className="text-[11px] text-text-lo">{AREA_DESCRIPTIONS[area]}</p></div>
                <div className="flex shrink-0 rounded-chip border border-line p-0.5">
                  {LEVELS.map((level) => {
                    const unsupported = level === "write" && (area === "stats" || area === "social" || area === "team");
                    return <button key={level} type="button" disabled={unsupported} onClick={() => setAreas({ ...areas, [area]: level })} className={cn("rounded-chip px-2 py-0.5 text-[11px] capitalize disabled:opacity-30", areaLevel(areas, area) === level ? "bg-bg-2 text-ice" : "text-text-lo hover:text-text-hi")}>{level}</button>;
                  })}
                </div>
              </div>
            ))}
            <p className="text-[11px] text-text-lo">Stats is read-only. Social and Team administration remain owner-only.</p>
          </div>
          <div>
            <label className="label-mono mb-1 block" htmlFor={`team-request-message-${request.id}`}>Invitation note (optional)</label>
            <Textarea id={`team-request-message-${request.id}`} value={inviteMessage} onChange={(event) => setInviteMessage(event.target.value)} rows={3} maxLength={1000} placeholder="Add context about the role or next steps" />
          </div>
          <div className="well flex flex-col gap-3 p-3 text-xs text-text-lo sm:flex-row sm:items-center">
            <p className="flex-1">Approving sends this access offer as an invitation. The Pro must still review and accept it before they can enter the workspace.</p>
            <Button type="button" size="sm" disabled={pending} onClick={() => void onInvite(role, areas, inviteMessage)}>{pending ? "Sending…" : "Approve & send invitation"}</Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
