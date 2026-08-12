"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, Lock, Plus, Search, Users } from "lucide-react";
import { useActiveArtist } from "@/components/active-artist-provider";
import { useArtistProfile } from "@/hooks/use-artist-profile";
import {
  useDiscoverScenes,
  useMyInvites,
  useMyScenes,
  useScenesSchemaReady,
  useSceneMutations,
} from "@/hooks/use-scenes";
import { SceneCard } from "@/components/scenes/scene-card";
import { DemoScenesView } from "@/components/demo/demo-scenes-view";
import { EmptyShaderPanel } from "@/components/shader-empty";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";
import { cn, errorMessage } from "@/lib/utils";

type Tab = "mine" | "discover" | "invites";

export default function ScenesView() {
  const { toast } = useToast();
  const { activeArtist } = useActiveArtist();
  const { profile, isLoading: profileLoading, publish } = useArtistProfile(
    activeArtist?.id ?? null
  );
  const myProfileId = profile?.id ?? null;
  const onNetwork =
    profile?.visibility === "members" || profile?.visibility === "public";

  const { data: schemaReady, isLoading: schemaLoading } = useScenesSchemaReady();
  const [tab, setTab] = React.useState<Tab>("mine");
  const [discoverQ, setDiscoverQ] = React.useState("");

  const { data: mine = [], isLoading: mineLoading } = useMyScenes();
  const { data: invites = [] } = useMyInvites();
  const { data: discover = [], isLoading: discoverLoading } = useDiscoverScenes(
    discoverQ,
    mine.map((s) => s.id)
  );
  const { join, declineInvite } = useSceneMutations();

  async function joinNetwork() {
    try {
      await publish.mutateAsync("members");
      toast("You’re on the network — visible to TEMPO members.", "ok");
    } catch (err) {
      toast(errorMessage(err, "Couldn’t join the network."));
    }
  }

  async function handleJoin(sceneId: string) {
    if (!myProfileId) return;
    try {
      const status = await join.mutateAsync({ sceneId, profileId: myProfileId });
      toast(
        status === "active" ? "You’re in." : "Request sent — waiting on approval.",
        "ok"
      );
    } catch (err) {
      toast(errorMessage(err, "Couldn’t join that scene."));
    }
  }

  async function handleAcceptInvite(sceneId: string) {
    if (!myProfileId) return;
    try {
      await join.mutateAsync({ sceneId, profileId: myProfileId });
      toast("You’re in.", "ok");
    } catch (err) {
      toast(errorMessage(err, "Couldn’t accept that invite."));
    }
  }

  async function handleDeclineInvite(sceneId: string) {
    if (!myProfileId) return;
    try {
      await declineInvite.mutateAsync({ sceneId, profileId: myProfileId });
    } catch (err) {
      toast(errorMessage(err, "Couldn’t decline that invite."));
    }
  }

  if (activeArtist?.demo_kind) {
    return <DemoScenesView />;
  }

  if (schemaLoading) {
    return <div className="panel h-64 animate-pulse" />;
  }

  if (schemaReady === false) {
    return (
      <div className="space-y-5">
        <PageHeader
          title="Scenes"
          subtitle="Rooms for the people you make music with."
        />
        <EmptyShaderPanel
          title="One more step"
          copy="Scenes needs a database update before it's ready — ask whoever manages your TEMPO database to run migration 049, then refresh this page."
        />
      </div>
    );
  }

  const networkGate = (
    <EmptyShaderPanel
      title="You’re off the network"
      copy="Joining a scene is a network act, same as Social — publish your artist profile so other members can see you're there."
      action={
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            type="button"
            size="sm"
            disabled={publish.isPending || profileLoading}
            onClick={() => void joinNetwork()}
          >
            <Users className="size-3.5" />
            Join as TEMPO member
          </Button>
          <Button asChild size="sm" variant="secondary">
            <Link href="/artist">
              <Lock className="size-3.5" />
              Network settings
            </Link>
          </Button>
        </div>
      }
    />
  );

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "mine", label: "My scenes" },
    { id: "discover", label: "Discover" },
    { id: "invites", label: "Invites", count: invites.length || undefined },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Scenes"
        subtitle="Rooms for the people you make music with."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild size="sm" variant="secondary">
              <Link href="/scene">
                Open Scene network
                <ArrowUpRight className="size-3.5" />
              </Link>
            </Button>
            {onNetwork ? (
              <Button asChild size="sm">
                <Link href="/scenes/new">
                  <Plus className="size-3.5" />
                  Start a scene
                </Link>
              </Button>
            ) : null}
          </div>
        }
      />

      {!onNetwork && !profileLoading ? (
        networkGate
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "rounded-chip border px-3 py-1.5 text-xs transition-colors",
                  tab === t.id
                    ? "border-ice/40 bg-ice/10 text-ice"
                    : "border-line text-text-lo hover:text-text-hi"
                )}
              >
                {t.label}
                {t.count ? (
                  <span className="ml-1.5 rounded-full bg-ice/20 px-1.5 py-0.5 text-[11px] text-ice">
                    {t.count}
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          {tab === "mine" ? (
            mineLoading ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="panel-quiet h-40 animate-pulse" />
                ))}
              </div>
            ) : mine.length === 0 ? (
              <EmptyShaderPanel
                title="You're not in a scene yet"
                copy="Find one in Discover, or start your own."
                action={
                  <Button asChild size="sm">
                    <Link href="/scenes/new">
                      <Plus className="size-3.5" />
                      Start a scene
                    </Link>
                  </Button>
                }
              />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {mine.map((scene) => (
                  <SceneCard key={scene.id} scene={scene} />
                ))}
              </div>
            )
          ) : null}

          {tab === "discover" ? (
            <div className="space-y-4">
              <div className="relative max-w-lg">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-text-lo" />
                <Input
                  value={discoverQ}
                  onChange={(e) => setDiscoverQ(e.target.value)}
                  placeholder="Search scenes by name"
                  className="pl-9"
                />
              </div>
              {discoverLoading ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="panel-quiet h-40 animate-pulse" />
                  ))}
                </div>
              ) : discover.length === 0 ? (
                <p className="text-sm text-text-lo">
                  {discoverQ.trim()
                    ? "No scenes match that name."
                    : "No scenes to discover yet — be the first to start one."}
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {discover.map((scene) => (
                    <div key={scene.id} className="space-y-2">
                      <SceneCard scene={scene} />
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="w-full"
                        disabled={join.isPending || scene.join_policy === "invite"}
                        onClick={() => void handleJoin(scene.id)}
                      >
                        {scene.join_policy === "invite"
                          ? "Invite only"
                          : scene.join_policy === "open"
                            ? "Join"
                            : "Ask to join"}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {tab === "invites" ? (
            invites.length === 0 ? (
              <p className="text-sm text-text-lo">No pending invites.</p>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {invites.map((scene) => (
                  <div key={scene.id} className="space-y-2">
                    <SceneCard scene={scene} />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        className="flex-1"
                        disabled={join.isPending}
                        onClick={() => void handleAcceptInvite(scene.id)}
                      >
                        Accept
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="flex-1"
                        disabled={declineInvite.isPending}
                        onClick={() => void handleDeclineInvite(scene.id)}
                      >
                        Decline
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : null}
        </div>
      )}
    </div>
  );
}
