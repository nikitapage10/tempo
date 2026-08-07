"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { Search, UserPlus } from "lucide-react";
import { useScene } from "@/hooks/use-scenes";
import {
  useSceneMemberMutations,
  useSceneMembers,
  useScenePendingRequests,
} from "@/hooks/use-scene-members";
import { SceneMemberRow } from "@/components/scenes/scene-member-row";
import { searchArtistProfiles } from "@/lib/api/people";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import type { SceneRole } from "@/lib/types";

export default function SceneManageMembersPage() {
  const params = useParams<{ slug: string }>();
  const { toast } = useToast();
  const { data: scene } = useScene(params.slug);
  const isOwner = scene?.my_role === "owner";

  const { data: members = [] } = useSceneMembers(scene?.id ?? null);
  const { data: pending = [] } = useScenePendingRequests(scene?.id ?? null, true);
  const { respond, invite, setRole, setBanned } = useSceneMemberMutations(scene?.id ?? null);

  const [inviteQ, setInviteQ] = React.useState("");
  const [inviteResults, setInviteResults] = React.useState<
    Awaited<ReturnType<typeof searchArtistProfiles>>
  >([]);

  React.useEffect(() => {
    if (!inviteQ.trim()) {
      setInviteResults([]);
      return;
    }
    const t = setTimeout(() => {
      void searchArtistProfiles(inviteQ).then(setInviteResults).catch(() => setInviteResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [inviteQ]);

  if (!scene) return null;
  const memberIds = new Set(members.map((m) => m.profile_id));

  async function handleInvite(profileId: string) {
    try {
      await invite.mutateAsync(profileId);
      toast("Invite sent.", "ok");
      setInviteQ("");
      setInviteResults([]);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't send that invite.");
    }
  }

  async function handleRespond(profileId: string, approve: boolean) {
    try {
      await respond.mutateAsync({ profileId, approve });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't update that request.");
    }
  }

  async function handleRole(profileId: string, role: SceneRole) {
    try {
      await setRole.mutateAsync({ profileId, role });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't change that role.");
    }
  }

  async function handleBan(profileId: string, banned: boolean) {
    try {
      await setBanned.mutateAsync({ profileId, banned });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't update that member.");
    }
  }

  return (
    <div className="space-y-6">
      {pending.length > 0 ? (
        <section className="space-y-2">
          <p className="label-mono">Requests to join ({pending.length})</p>
          <div className="space-y-1.5">
            {pending.map((m) => (
              <SceneMemberRow
                key={m.profile_id}
                member={m}
                actions={
                  <>
                    <Button
                      type="button"
                      size="sm"
                      disabled={respond.isPending}
                      onClick={() => void handleRespond(m.profile_id, true)}
                    >
                      Approve
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={respond.isPending}
                      onClick={() => void handleRespond(m.profile_id, false)}
                    >
                      Decline
                    </Button>
                  </>
                }
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-2">
        <p className="label-mono">Invite someone</p>
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-text-lo" />
          <Input
            value={inviteQ}
            onChange={(e) => setInviteQ(e.target.value)}
            placeholder="Search artists by name or handle"
            className="pl-9"
          />
        </div>
        {inviteResults.length > 0 ? (
          <div className="max-w-md space-y-1.5">
            {inviteResults.map((p) => (
              <div key={p.id} className="well flex items-center justify-between gap-3 rounded-input px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm text-text-hi">{p.display_name}</p>
                  <p className="truncate text-xs text-text-lo">@{p.handle}</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={invite.isPending || memberIds.has(p.id)}
                  onClick={() => void handleInvite(p.id)}
                >
                  <UserPlus className="size-3.5" />
                  {memberIds.has(p.id) ? "Already in" : "Invite"}
                </Button>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="space-y-2">
        <p className="label-mono">Members ({members.length})</p>
        <div className="space-y-1.5">
          {members.map((m) => (
            <SceneMemberRow
              key={m.profile_id}
              member={m}
              actions={
                <>
                  {isOwner && m.role !== "owner" ? (
                    <select
                      value={m.role}
                      onChange={(e) => void handleRole(m.profile_id, e.target.value as SceneRole)}
                      className="h-7 rounded-input border border-line bg-bg-2 px-2 text-xs text-text-hi"
                    >
                      <option value="member">Member</option>
                      <option value="moderator">Moderator</option>
                    </select>
                  ) : null}
                  {m.role !== "owner" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={setBanned.isPending}
                      onClick={() => void handleBan(m.profile_id, true)}
                    >
                      Ban
                    </Button>
                  ) : null}
                </>
              }
            />
          ))}
        </div>
      </section>
    </div>
  );
}
