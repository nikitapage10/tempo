"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { LfWindow } from "@/components/lf-windows";
import { PageHeader } from "@/components/ui/page-header";
import { useActiveArtist } from "@/components/active-artist-provider";
import { useWorkspaceMode } from "@/hooks/use-workspace-mode";
import { useActiveTeamRoster } from "@/hooks/use-artist-members";
import { useCurrentUser } from "@/hooks/use-current-user";
import { TeamConstellation, type ConstellationPerson } from "@/components/team/team-constellation";
import { TeamManager } from "@/components/team/team-manager";
import { ArtistTeamRequests } from "@/components/team/artist-team-requests";
import { PendingTeamInvites } from "@/components/team/pending-team-invites";
import { ProTeamRequests } from "@/components/team/pro-team-requests";
import { WorkHub } from "@/components/team/work-hub";
import { TeamTabs } from "@/components/team/team-tabs";
import { MyWorkPanel } from "@/components/team/my-work-panel";
import { ProSchedulePanel } from "@/components/team/pro-schedule-panel";
import { TeamBriefPanel } from "@/components/team/team-brief-panel";
import { ArtistWaitingPanel } from "@/components/team/artist-waiting-panel";
import { StarterKitSetup } from "@/components/team/starter-kit-setup";
import { DemoTeamPanel } from "@/components/demo/demo-team-panel";
import { DEMO_TEAM } from "@/lib/demo/president";
import { fetchMemberProfiles } from "@/lib/api/member-profile";
import { listMemberOfArtists } from "@/lib/api/artist-members";
import { AREA_DESCRIPTIONS, AREA_KEYS, AREA_LABELS, type AreaLevel } from "@/lib/team/areas";
import { ROLE_LABELS } from "@/lib/team/roles";
import { membershipArtists } from "@/lib/workspace-mode";

const LEVEL_LABELS: Record<AreaLevel, string> = { none: "None", read: "Read", write: "Write" };

export default function TeamPage() {
  const { artists, activeArtist, isLoading: artistLoading } = useActiveArtist();
  const user = useCurrentUser();
  const { mode, isOwner, areas, isLoading: membershipLoading } = useWorkspaceMode();
  const [proTab, setProTab] = React.useState<"work" | "schedule" | "roster">("work");
  const [artistTab, setArtistTab] = React.useState<"people" | "brief" | "waiting">("people");

  React.useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get("tab");
    if (tab === "work" || tab === "schedule" || tab === "roster") setProTab(tab);
    if (tab === "people" || tab === "brief" || tab === "waiting") setArtistTab(tab);
  }, []);

  function selectTab(tab: string) {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.replaceState({}, "", url);
  }
  const rosterQuery = useActiveTeamRoster(
    mode === "work" ? null : (activeArtist?.id ?? null)
  );
  const membershipsQuery = useQuery({
    queryKey: ["member-of-artists", user?.id],
    queryFn: listMemberOfArtists,
    enabled: !!user && mode === "work",
    staleTime: 60_000,
  });

  const activeMembers = (rosterQuery.data ?? []).filter((m) => m.userId);
  const memberUserIds = activeMembers.map((m) => m.userId!);
  const profilesQuery = useQuery({
    queryKey: ["member-profiles", memberUserIds.slice().sort()],
    queryFn: () => fetchMemberProfiles(memberUserIds),
    enabled: memberUserIds.length > 0,
    staleTime: 30_000,
  });

  const loading = artistLoading || membershipLoading;

  if (mode === "work") {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Team operations"
          subtitle="Your work, schedule, and artist relationships in one private Pro home."
        />
        <PendingTeamInvites />
        <TeamTabs
          tabs={[{ key: "work", label: "My Work" }, { key: "schedule", label: "Schedule" }, { key: "roster", label: "Roster" }] as const}
          active={proTab}
          onChange={(tab) => { setProTab(tab); selectTab(tab); }}
        />
        {proTab === "work" ? <MyWorkPanel /> : null}
        {proTab === "schedule" ? <ProSchedulePanel /> : null}
        {proTab === "roster" ? <div className="space-y-8"><ProTeamRequests /><WorkHub artists={membershipArtists(artists, user?.id)} memberships={membershipsQuery.data ?? []} /></div> : null}
        <StarterKitSetup />
      </div>
    );
  }

  // The demo artist has no real memberships — a membership needs a real
  // person behind it — so its team is sample people, shown the same way.
  const isDemo = Boolean(activeArtist?.demo_kind);
  const demoPeople: ConstellationPerson[] = isDemo
    ? DEMO_TEAM.filter((member) => !member.pending).map((member) => ({
        id: `demo-${member.ref}`,
        name: member.name,
        subtitle: member.title,
        avatarUrl: member.photo,
      }))
    : [];

  const people: ConstellationPerson[] = [
    {
      id: activeArtist?.id ?? "artist",
      name: activeArtist?.name ?? "Artist",
      subtitle: "Artist",
      avatarUrl: activeArtist?.emblem_url ?? activeArtist?.logo_url ?? null,
      featured: true,
    },
    ...demoPeople,
    ...activeMembers.map((m) => {
      const profile = profilesQuery.data?.get(m.userId!);
      return {
        id: m.id,
        name: profile?.displayName || "Pro",
        subtitle: ROLE_LABELS[m.role],
        avatarUrl: profile?.avatarUrl,
      };
    }),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team"
        subtitle="People, shared context, and work waiting on this artist’s team."
      />
      <TeamTabs
        tabs={[{ key: "people", label: "People" }, { key: "brief", label: "Brief" }, { key: "waiting", label: "Waiting" }] as const}
        active={artistTab}
        onChange={(tab) => { setArtistTab(tab); selectTab(tab); }}
      />

      {artistTab === "people" ? <><div className="glass-hero prism-edge relative overflow-hidden">
        <div className="absolute inset-0">
          <LfWindow field className="absolute inset-0 opacity-60" aria-hidden />
          <div className="scrim-reveal absolute inset-0" aria-hidden />
        </div>
        <div className="relative z-[1]">
          {loading ? (
            <div className="flex h-56 items-center justify-center">
              <div className="size-24 animate-pulse rounded-xl bg-bg-2" />
            </div>
          ) : (
            <TeamConstellation
              title="The team"
              description="The artist, and everyone working with them."
              people={people}
            />
          )}
        </div>
      </div>

      {!activeArtist ? null : isDemo ? (
        <DemoTeamPanel />
      ) : isOwner ? (
        <div className="space-y-6">
          <ArtistTeamRequests artistId={activeArtist.id} />
          <TeamManager artistId={activeArtist.id} />
        </div>
      ) : (
        <div className="panel-quiet p-4">
          <p className="label-mono mb-3">What you can access here</p>
          <dl className="space-y-2 text-sm">
            {AREA_KEYS.map((area) => (
              <div key={area} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <dt className="text-text-hi">{AREA_LABELS[area]}</dt>
                  <dd className="text-xs text-text-lo">{AREA_DESCRIPTIONS[area]}</dd>
                </div>
                <span className="shrink-0 text-xs text-text-lo">
                  {LEVEL_LABELS[areas[area] ?? "none"]}
                </span>
              </div>
            ))}
          </dl>
        </div>
      )}</> : null}
      {artistTab === "brief" && activeArtist ? (
        <TeamBriefPanel artistId={activeArtist.id} artistName={activeArtist.name} isOwner={isOwner} />
      ) : null}
      {artistTab === "waiting" && activeArtist ? <ArtistWaitingPanel artistId={activeArtist.id} /> : null}
    </div>
  );
}
