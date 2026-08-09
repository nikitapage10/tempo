"use client";

import Link from "next/link";
import * as React from "react";
import { useSearchParams } from "next/navigation";
import { BookOpen, CalendarDays, FileText, Images, MessageCircle, MessagesSquare, Settings2, Users } from "lucide-react";
import { SceneHero } from "@/components/scenes/scene-hero";
import { SceneFeed } from "@/components/scenes/scene-feed";
import { SceneEvents } from "@/components/scenes/scene-events";
import { SceneChatPanel } from "@/components/scenes/scene-chat-panel";
import { SceneMemberRow } from "@/components/scenes/scene-member-row";
import { ScenePulseRail } from "@/components/scenes/scene-pulse-rail";
import { SceneSectionContent } from "@/components/scenes/scene-section-content";
import { EmptyShaderPanel } from "@/components/shader-empty";
import { Button } from "@/components/ui/button";
import { useScene } from "@/hooks/use-scenes";
import { useSceneMembers } from "@/hooks/use-scene-members";
import { useMyScenePersona, useSceneSections, useSceneV2Mutations } from "@/hooks/use-scene-v2";
import { useToast } from "@/components/ui/toast";
import { cn, errorMessage } from "@/lib/utils";

const ICONS = { discussion: MessagesSquare, chat: MessageCircle, events: CalendarDays, library: BookOpen, showcase: Images, page: FileText } as const;

export function StandaloneSceneView({ slug }: { slug: string }) {
  const params = useSearchParams();
  const { toast } = useToast();
  const { data: scene, isLoading, isError } = useScene(slug);
  const { data: persona } = useMyScenePersona(scene?.id ?? null);
  const { data: sections = [] } = useSceneSections(scene?.id ?? null);
  const { data: members = [] } = useSceneMembers(scene?.my_status === "active" ? scene.id : null);
  const mutations = useSceneV2Mutations(scene?.id ?? null);
  const selected = params.get("section") || "pulse";
  const section = sections.find((item) => item.slug === selected) ?? null;
  const profileId = persona?.artist_profile_id ?? null;
  const isManager = scene?.my_role === "owner" || scene?.my_role === "moderator";
  async function join() {
    if (!scene) return;
    try { const personaId = persona?.id ?? await mutations.ensurePersona.mutateAsync({ sceneId: scene.id, displayName: "Member" }); await mutations.join.mutateAsync({ sceneId: scene.id, personaId }); toast("Welcome to the Scene.", "ok"); }
    catch (error) { toast(errorMessage(error, "Couldn't join this Scene.")); }
  }
  if (isLoading) return <div className="mx-auto max-w-6xl"><div className="panel h-72 animate-pulse" /></div>;
  if (isError || !scene) return <EmptyShaderPanel title="That Scene isn't available" copy="It may be private, archived, or no longer published." />;
  const actions = <>{isManager ? <Link href={`/scene-studio/${scene.slug}`}><Button variant="secondary" size="sm"><Settings2 className="size-3.5" />Manage</Button></Link> : null}{scene.my_status !== "active" ? <Button size="sm" onClick={() => void join()} disabled={mutations.join.isPending || mutations.ensurePersona.isPending}>Join Scene</Button> : null}</>;
  const memberOnly = scene.my_status !== "active" && selected !== "about";
  return <div className="mx-auto max-w-6xl space-y-5"><SceneHero scene={scene} actions={actions} /><nav className="flex gap-1 overflow-x-auto rounded-panel border border-line bg-bg-1/80 p-1.5 backdrop-blur"><Link href={`/scene/${slug}`} className={cn("shrink-0 rounded-chip border px-3 py-1.5 text-xs", selected === "pulse" ? "border-ice/40 bg-ice/10 text-ice" : "border-transparent text-text-lo")}>Pulse</Link>{sections.map((item) => { const Icon = ICONS[item.type]; return <Link key={item.id} href={`/scene/${slug}?section=${item.slug}`} className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-chip border px-3 py-1.5 text-xs", selected === item.slug ? "border-ice/40 bg-ice/10 text-ice" : "border-transparent text-text-lo hover:text-text-hi")}><Icon className="size-3.5" />{item.name}</Link>; })}<Link href={`/scene/${slug}?section=members`} className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-chip border px-3 py-1.5 text-xs", selected === "members" ? "border-ice/40 bg-ice/10 text-ice" : "border-transparent text-text-lo")}><Users className="size-3.5" />Members</Link><Link href={`/scene/${slug}?section=about`} className={cn("shrink-0 rounded-chip border px-3 py-1.5 text-xs", selected === "about" ? "border-ice/40 bg-ice/10 text-ice" : "border-transparent text-text-lo")}>About</Link></nav>{memberOnly ? <EmptyShaderPanel title="This is where the network comes alive" copy={`Join ${scene.name} to take part in conversations, events, resources, and member spaces.`} /> : <>{selected === "pulse" ? <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_280px]"><SceneFeed sceneId={scene.id} myProfileId={profileId} isManager={isManager} /><ScenePulseRail scene={scene} /></div> : null}{section?.type === "discussion" ? <SceneFeed sceneId={scene.id} myProfileId={profileId} isManager={isManager} /> : null}{section?.type === "events" ? <SceneEvents sceneId={scene.id} myProfileId={profileId} isManager={isManager} /> : null}{section?.type === "chat" ? <SceneChatPanel sceneId={scene.id} myProfileId={profileId} members={members} /> : null}{section && ["library", "showcase", "page"].includes(section.type) ? <SceneSectionContent section={section} /> : null}{selected === "members" ? <div className="space-y-2">{members.map((member) => <SceneMemberRow key={member.id ?? member.user_id} member={member} />)}</div> : null}{selected === "about" ? <div className="panel mx-auto max-w-3xl p-6 sm:p-9"><p className="label-mono">About</p><h2 className="mt-2 font-display text-2xl font-semibold text-text-hi">{scene.name}</h2><p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-text-mid">{scene.about || scene.public_summary || "This Scene is still writing its story."}</p>{scene.rules ? <><p className="label-mono mt-8">Community rhythm</p><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-text-mid">{scene.rules}</p></> : null}</div> : null}</>}</div>;
}
