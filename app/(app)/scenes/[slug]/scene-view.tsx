"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BookOpen, CalendarDays, FileText, Images, MessageCircle, MessagesSquare, Sparkles } from "lucide-react";
import { useActiveArtist } from "@/components/active-artist-provider";
import { useArtistProfile } from "@/hooks/use-artist-profile";
import { useScene, useSceneMutations } from "@/hooks/use-scenes";
import { useSceneMembers } from "@/hooks/use-scene-members";
import { useSceneSections } from "@/hooks/use-scene-v2";
import { SceneHeader } from "@/components/scenes/scene-header";
import { SceneMemberRow } from "@/components/scenes/scene-member-row";
import { SceneFeed } from "@/components/scenes/scene-feed";
import { SceneEvents } from "@/components/scenes/scene-events";
import { SceneChatPanel } from "@/components/scenes/scene-chat-panel";
import { SceneWelcomeChecklist } from "@/components/scenes/scene-welcome-checklist";
import { ScenePulseRail } from "@/components/scenes/scene-pulse-rail";
import { SceneSectionContent } from "@/components/scenes/scene-section-content";
import { EmptyShaderPanel } from "@/components/shader-empty";
import { useToast } from "@/components/ui/toast";
import { cn, errorMessage } from "@/lib/utils";

const CORE_TABS = [{ id: "feed", label: "Pulse" }, { id: "members", label: "Members" }, { id: "about", label: "About" }] as const;
type CoreTab = (typeof CORE_TABS)[number]["id"];
const SECTION_ICONS = { discussion: MessagesSquare, chat: MessageCircle, events: CalendarDays, library: BookOpen, showcase: Images, page: FileText } as const;

export default function SceneView({ slug }: { slug: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { activeArtist } = useActiveArtist();
  const { profile } = useArtistProfile(activeArtist?.id ?? null);
  const myProfileId = profile?.id ?? null;
  const { data: scene, isLoading, isError } = useScene(slug);
  const { data: sections = [] } = useSceneSections(scene?.id ?? null);
  const { join, leave } = useSceneMutations();
  const { data: members = [], isLoading: membersLoading } = useSceneMembers(scene?.my_status === "active" ? scene.id : null);
  const section = sections.find((item) => item.slug === searchParams.get("section")) ?? null;
  const tabParam = searchParams.get("tab");
  const active: CoreTab = CORE_TABS.some((tab) => tab.id === tabParam) ? (tabParam as CoreTab) : "feed";

  function selectTab(id: CoreTab) {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("section");
    if (id === "feed") next.delete("tab"); else next.set("tab", id);
    router.replace(next.size ? `/scenes/${slug}?${next}` : `/scenes/${slug}`, { scroll: false });
  }
  function selectSection(sectionSlug: string) {
    const next = new URLSearchParams();
    next.set("section", sectionSlug);
    router.replace(`/scenes/${slug}?${next}`, { scroll: false });
  }
  async function handleJoin() {
    if (!scene || !myProfileId) return;
    try { const status = await join.mutateAsync({ sceneId: scene.id, profileId: myProfileId }); toast(status === "active" ? "You're in." : "Request sent — waiting on approval.", "ok"); }
    catch (err) { toast(errorMessage(err, "Couldn't join that scene.")); }
  }
  async function handleLeave() {
    if (!scene || !myProfileId) return;
    try { await leave.mutateAsync({ sceneId: scene.id, profileId: myProfileId }); toast(`You left ${scene.name}.`, "ok"); }
    catch (err) { toast(errorMessage(err, "Couldn't leave that scene.")); }
  }
  if (isLoading) return <div className="panel h-64 animate-pulse" />;
  if (isError || !scene) return <EmptyShaderPanel title="That scene isn't available" copy="It may be unlisted, archived, or you may not have access." />;

  const isMember = scene.my_status === "active";
  const isManager = scene.my_role === "owner" || scene.my_role === "moderator";
  return <div className="space-y-5">
    <SceneHeader scene={scene} joinPending={join.isPending} onJoin={() => void handleJoin()} onAcceptInvite={() => void handleJoin()} onLeave={() => void handleLeave()} />
    {isMember ? <SceneWelcomeChecklist scene={scene} myMember={members.find((member) => member.profile_id === myProfileId)} myProfileId={myProfileId} /> : null}
    <nav className="flex gap-1.5 overflow-x-auto rounded-panel border border-line bg-bg-1/70 p-1.5 shadow-e1 backdrop-blur-xl">
      {CORE_TABS.map((tab) => <button key={tab.id} type="button" onClick={() => selectTab(tab.id)} className={cn("shrink-0 rounded-chip border px-3 py-1.5 text-xs transition-colors", !section && active === tab.id ? "border-ice/40 bg-ice/10 text-ice" : "border-transparent text-text-lo hover:border-line hover:text-text-hi")}>{tab.label}</button>)}
      {sections.map((item) => { const Icon = SECTION_ICONS[item.type]; return <button key={item.id} type="button" onClick={() => selectSection(item.slug)} className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-chip border px-3 py-1.5 text-xs transition-colors", section?.id === item.id ? "border-ice/40 bg-ice/10 text-ice" : "border-transparent text-text-lo hover:border-line hover:text-text-hi")}><Icon className="size-3.5" />{item.name}</button>; })}
    </nav>
    {!isMember && active !== "about" ? <EmptyShaderPanel title="Members only" copy={`Join ${scene.name} to enter the network and explore its conversations, events, and shared resources.`} /> : <>
      {section?.type === "discussion" ? <SceneFeed sceneId={scene.id} myProfileId={myProfileId} isManager={isManager} /> : null}
      {section?.type === "events" ? <SceneEvents sceneId={scene.id} myProfileId={myProfileId} isManager={isManager} /> : null}
      {section?.type === "chat" ? <SceneChatPanel sceneId={scene.id} myProfileId={myProfileId} members={members} /> : null}
      {section && ["library", "page", "showcase"].includes(section.type) ? <SceneSectionContent section={section} /> : null}
      {!section && active === "feed" ? <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_280px]"><div className="space-y-4"><div className="panel-quiet flex items-center justify-between p-4"><div><p className="label-mono">Scene pulse</p><h2 className="mt-1 font-display text-lg font-semibold text-text-hi">What is moving in {scene.name}</h2></div><Sparkles className="size-5 text-amber" /></div><SceneFeed sceneId={scene.id} myProfileId={myProfileId} isManager={isManager} /></div><ScenePulseRail scene={scene} /></div> : null}
      {!section && active === "members" ? membersLoading ? <div className="panel-quiet h-40 animate-pulse" /> : members.length ? <div className="space-y-1.5">{members.map((member) => <SceneMemberRow key={member.id ?? member.profile_id ?? member.user_id} member={member} />)}</div> : <p className="text-sm text-text-lo">No members yet.</p> : null}
      {!section && active === "about" ? <div className="panel grid gap-6 p-5 sm:grid-cols-[minmax(0,1fr)_240px]"><div><p className="label-mono">About this Scene</p><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-text-hi">{scene.about || scene.public_summary || "This Scene is still writing its story."}</p>{scene.rules ? <><p className="label-mono mt-6">How we gather</p><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-text-mid">{scene.rules}</p></> : null}</div><dl className="space-y-4 rounded-panel border border-line bg-bg-2/50 p-4 text-sm"><div><dt className="label-mono">Members</dt><dd className="mt-1 text-text-hi">{scene.member_count}</dd></div><div><dt className="label-mono">Access</dt><dd className="mt-1 text-text-hi">{scene.join_policy === "open" ? "Open to join" : scene.join_policy === "request" ? "Approval required" : "Invite only"}</dd></div>{scene.location ? <div><dt className="label-mono">Home base</dt><dd className="mt-1 text-text-hi">{scene.location}</dd></div> : null}</dl></div> : null}
    </>}
  </div>;
}
