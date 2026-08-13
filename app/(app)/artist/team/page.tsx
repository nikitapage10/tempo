"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { LfWindow } from "@/components/lf-windows";
import { PageHeader } from "@/components/ui/page-header";
import { useActiveArtist } from "@/components/active-artist-provider";
import { useArtistMembership } from "@/hooks/use-artist-membership";
import { useArtistMembers } from "@/hooks/use-artist-members";
import { useCurrentUser } from "@/hooks/use-current-user";
import { TeamConstellation, type ConstellationPerson } from "@/components/team/team-constellation";
import { TeamManager } from "@/components/team/team-manager";
import { MyMemberProfile } from "@/components/team/my-member-profile";
import { fetchMemberProfiles } from "@/lib/api/member-profile";
import { AREA_DESCRIPTIONS, AREA_KEYS, AREA_LABELS, type AreaLevel } from "@/lib/team/areas";
import { ROLE_LABELS } from "@/lib/team/roles";

const LEVEL_LABELS: Record<AreaLevel, string> = { none: "None", read: "Read", write: "Write" };

export default function TeamPage() {
  const { activeArtist, isLoading: artistLoading } = useActiveArtist();
  const user = useCurrentUser();
  const { isOwner, areas, isLoading: membershipLoading } = useArtistMembership(activeArtist);
  const { data: members } = useArtistMembers(isOwner ? (activeArtist?.id ?? null) : null);

  const activeMembers = (members ?? []).filter((m) => m.status === "active" && m.userId);
  const memberUserIds = activeMembers.map((m) => m.userId!);

  const profilesQuery = useQuery({
    queryKey: ["member-profiles", memberUserIds.slice().sort()],
    queryFn: () => fetchMemberProfiles(memberUserIds),
    enabled: memberUserIds.length > 0,
    staleTime: 30_000,
  });

  const loading = artistLoading || membershipLoading;

  const centerPerson: ConstellationPerson = {
    id: activeArtist?.id ?? "artist",
    name: activeArtist?.name ?? "Artist",
    subtitle: "Artist",
    avatarUrl: activeArtist?.emblem_url ?? activeArtist?.logo_url ?? null,
  };

  const orbitPeople: ConstellationPerson[] = isOwner
    ? activeMembers.map((m) => {
        const profile = profilesQuery.data?.get(m.userId!);
        return {
          id: m.id,
          name: profile?.displayName || m.invitedEmail || "Team member",
          subtitle: ROLE_LABELS[m.role],
          avatarUrl: profile?.avatarUrl,
        };
      })
    : user
      ? [
          {
            id: user.id,
            name: user.email ?? "You",
            subtitle: "You",
            avatarUrl: null,
          },
        ]
      : [];

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
              <div className="size-24 animate-pulse rounded-full bg-bg-2" />
            </div>
          ) : (
            <TeamConstellation center={centerPerson} people={orbitPeople} />
          )}
        </div>
      </div>

      {!activeArtist ? null : isOwner ? (
        <TeamManager artistId={activeArtist.id} />
      ) : (
        <div className="space-y-4">
          <MyMemberProfile />
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
        </div>
      )}
    </div>
  );
}
