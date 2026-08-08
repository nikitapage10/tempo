"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useActiveArtist } from "@/components/active-artist-provider";
import { useArtistProfile } from "@/hooks/use-artist-profile";
import { useScene, useSceneMutations } from "@/hooks/use-scenes";
import { useSceneMembers } from "@/hooks/use-scene-members";
import { SceneHeader } from "@/components/scenes/scene-header";
import { SceneMemberRow } from "@/components/scenes/scene-member-row";
import { SceneFeed } from "@/components/scenes/scene-feed";
import { SceneEvents } from "@/components/scenes/scene-events";
import { SceneChatPanel } from "@/components/scenes/scene-chat-panel";
import { SceneWelcomeChecklist } from "@/components/scenes/scene-welcome-checklist";
import { EmptyShaderPanel } from "@/components/shader-empty";
import { useToast } from "@/components/ui/toast";
import { cn, errorMessage } from "@/lib/utils";

const TABS = [
  { id: "feed", label: "Feed" },
  { id: "events", label: "Events" },
  { id: "members", label: "Members" },
  { id: "chat", label: "Chat" },
  { id: "about", label: "About" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function isTabId(value: string | null | undefined): value is TabId {
  return TABS.some((t) => t.id === value);
}

export default function SceneView({ slug }: { slug: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { activeArtist } = useActiveArtist();
  const { profile } = useArtistProfile(activeArtist?.id ?? null);
  const myProfileId = profile?.id ?? null;

  const { data: scene, isLoading, isError } = useScene(slug);
  const { join, leave } = useSceneMutations();
  const { data: members = [], isLoading: membersLoading } = useSceneMembers(
    scene?.my_status === "active" ? scene.id : null
  );

  const paramTab = searchParams.get("tab");
  const active: TabId = isTabId(paramTab) ? paramTab : "feed";

  function selectTab(id: TabId) {
    const next = new URLSearchParams(searchParams.toString());
    if (id === "feed") next.delete("tab");
    else next.set("tab", id);
    const qs = next.toString();
    router.replace(qs ? `/scenes/${slug}?${qs}` : `/scenes/${slug}`, { scroll: false });
  }

  async function handleJoin() {
    if (!scene || !myProfileId) return;
    try {
      const status = await join.mutateAsync({ sceneId: scene.id, profileId: myProfileId });
      toast(status === "active" ? "You're in." : "Request sent — waiting on approval.", "ok");
    } catch (err) {
      toast(errorMessage(err, "Couldn't join that scene."));
    }
  }

  async function handleAcceptInvite() {
    if (!scene || !myProfileId) return;
    try {
      await join.mutateAsync({ sceneId: scene.id, profileId: myProfileId });
      toast("You're in.", "ok");
    } catch (err) {
      toast(errorMessage(err, "Couldn't accept that invite."));
    }
  }

  async function handleLeave() {
    if (!scene || !myProfileId) return;
    try {
      await leave.mutateAsync({ sceneId: scene.id, profileId: myProfileId });
      toast(`You left ${scene.name}.`, "ok");
    } catch (err) {
      toast(errorMessage(err, "Couldn't leave that scene."));
    }
  }

  if (isLoading) {
    return <div className="panel h-64 animate-pulse" />;
  }

  if (isError || !scene) {
    return (
      <EmptyShaderPanel
        title="That scene isn't available"
        copy="It may be unlisted, archived, or you may not have access."
      />
    );
  }

  const isMember = scene.my_status === "active";
  const isManager = scene.my_role === "owner" || scene.my_role === "moderator";

  return (
    <div className="space-y-5">
      <SceneHeader
        scene={scene}
        joinPending={join.isPending}
        onJoin={() => void handleJoin()}
        onAcceptInvite={() => void handleAcceptInvite()}
        onLeave={() => void handleLeave()}
      />

      {isMember ? (
        <SceneWelcomeChecklist
          scene={scene}
          myMember={members.find((m) => m.profile_id === myProfileId)}
          myProfileId={myProfileId}
        />
      ) : null}

      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => selectTab(t.id)}
            className={cn(
              "rounded-chip border px-3 py-1.5 text-xs transition-colors",
              active === t.id
                ? "border-ice/40 bg-ice/10 text-ice"
                : "border-line text-text-lo hover:text-text-hi"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {!isMember && active !== "about" ? (
        <EmptyShaderPanel
          title="Members only"
          copy={`Join ${scene.name} to see its ${TABS.find((t) => t.id === active)?.label.toLowerCase()}.`}
        />
      ) : (
        <>
          {active === "feed" ? (
            <SceneFeed sceneId={scene.id} myProfileId={myProfileId} isManager={isManager} />
          ) : null}
          {active === "events" ? (
            <SceneEvents sceneId={scene.id} myProfileId={myProfileId} isManager={isManager} />
          ) : null}
          {active === "chat" ? (
            <SceneChatPanel sceneId={scene.id} myProfileId={myProfileId} members={members} />
          ) : null}

          {active === "members" ? (
            membersLoading ? (
              <div className="panel-quiet h-40 animate-pulse" />
            ) : members.length === 0 ? (
              <p className="text-sm text-text-lo">No members yet.</p>
            ) : (
              <div className="space-y-1.5">
                {members.map((m) => (
                  <SceneMemberRow key={m.profile_id} member={m} />
                ))}
              </div>
            )
          ) : null}

          {active === "about" ? (
            <div className="panel space-y-4 p-5">
              {scene.about ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-hi">
                  {scene.about}
                </p>
              ) : (
                <p className="text-sm text-text-lo">No description yet.</p>
              )}
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="label-mono">Members</dt>
                  <dd className="mt-1 text-text-hi">{scene.member_count}</dd>
                </div>
                <div>
                  <dt className="label-mono">How to join</dt>
                  <dd className="mt-1 text-text-hi">
                    {scene.join_policy === "open"
                      ? "Open — anyone can join"
                      : scene.join_policy === "request"
                        ? "Ask to join — a manager approves"
                        : "Invite only"}
                  </dd>
                </div>
              </dl>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
