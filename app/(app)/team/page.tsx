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
import { WorkHub } from "@/components/team/work-hub";
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
          title="Artists you work with"
          subtitle="A window into each artist who’s brought you onto their team — open a snapshot, or step into their workspace when you need to do the work."
        />
        <WorkHub
          artists={membershipArtists(artists, user?.id)}
          memberships={membershipsQuery.data ?? []}
        />
      </div>
    );
  }

  const people: ConstellationPerson[] = [
    {
      id: activeArtist?.id ?? "artist",
      name: activeArtist?.name ?? "Artist",
      subtitle: "Artist",
      avatarUrl: activeArtist?.emblem_url ?? activeArtist?.logo_url ?? null,
      featured: true,
    },
    ...activeMembers.map((m) => {
      const profile = profilesQuery.data?.get(m.userId!);
      return {
        id: m.id,
        name: profile?.displayName || "Team member",
        subtitle: ROLE_LABELS[m.role],
        avatarUrl: profile?.avatarUrl,
      };
    }),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team"
        subtitle="Everyone who works with this artist, and exactly what they can reach."
      />

      <div className="glass-hero prism-edge relative overflow-hidden">
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

      {!activeArtist ? null : isOwner ? (
        <TeamManager artistId={activeArtist.id} />
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
      )}
    </div>
  );
}
