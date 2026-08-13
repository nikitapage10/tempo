"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays, Flame, Radio, Sparkles, Users } from "lucide-react";
import { useSceneAnalytics, useSceneBadges, useScenePersonas } from "@/hooks/use-scene-v2";
import type { Scene } from "@/lib/types";

export function ScenePulseRail({ scene }: { scene: Scene }) {
  const { data: personas = [] } = useScenePersonas(scene.my_status === "active" ? scene.id : null);
  const { data: badges = [] } = useSceneBadges(scene.my_status === "active" ? scene.id : null);
  const { data: analytics } = useSceneAnalytics(scene.my_role === "owner" || scene.my_role === "moderator" ? scene.id : null, 30);
  const recent = personas.slice(0, 5);
  return (
    <aside className="space-y-3 lg:sticky lg:top-6 lg:self-start">
      <div className="panel-quiet overflow-hidden p-4">
        <div className="flex items-center justify-between"><p className="label-mono">Scene pulse</p><Radio className="size-4 text-ice" /></div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-input border border-line bg-bg-1 p-3"><p className="stat-value text-xl text-text-hi">{analytics?.active_members ?? scene.member_count}</p><p className="mt-1 text-xs text-text-lo">active members</p></div>
          <div className="rounded-input border border-line bg-bg-1 p-3"><p className="stat-value text-xl text-text-hi">{analytics?.posts ?? 0}</p><p className="mt-1 text-xs text-text-lo">posts this month</p></div>
        </div>
      </div>
      <div className="panel-quiet p-4">
        <div className="flex items-center justify-between"><p className="label-mono">Recently here</p><Users className="size-4 text-text-lo" /></div>
        <div className="mt-3 space-y-2.5">{recent.length ? recent.map((persona) => <div key={persona.id} className="flex items-center gap-2.5"><div className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-ice/30 to-amber/20 font-display text-xs font-semibold text-text-hi">{persona.display_name.slice(0, 2).toUpperCase()}</div><div className="min-w-0"><p className="truncate text-xs font-medium text-text-hi">{persona.display_name}</p><p className="text-[11px] text-text-lo">{persona.location || "Member"}</p></div><span className="ml-auto size-1.5 rounded-full bg-success" /></div>) : <p className="text-xs text-text-lo">Member activity will appear here.</p>}</div>
      </div>
      <div className="panel-quiet p-4">
        <div className="flex items-center gap-2"><Sparkles className="size-4 text-amber" /><p className="label-mono">Recognition</p></div>
        <div className="mt-3 flex flex-wrap gap-2">{badges.length ? badges.slice(0, 4).map((badge) => <span key={badge.id} title={badge.description || badge.name} className="rounded-chip border border-amber/20 bg-amber/5 px-2 py-1 text-xs text-amber">{badge.icon} {badge.name}</span>) : <span className="text-xs text-text-lo">Badges and contributions land here.</span>}</div>
      </div>
      {(scene.my_role === "owner" || scene.my_role === "moderator") ? <Link href={`/scenes/${scene.slug}/manage`} className="flex items-center justify-between rounded-input border border-line px-3 py-2 text-xs text-text-lo transition hover:border-ice/30 hover:text-ice"><span className="inline-flex items-center gap-2"><Flame className="size-3.5" />Open Scene Studio</span><ArrowRight className="size-3.5" /></Link> : null}
    </aside>
  );
}
