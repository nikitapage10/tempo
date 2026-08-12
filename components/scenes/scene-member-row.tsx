"use client";

import Link from "next/link";
import { ArtistMark } from "@/components/artists/artist-mark";
import type { SceneMember } from "@/lib/types";
import { cn } from "@/lib/utils";

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  moderator: "Moderator",
  member: "Member",
};

export function SceneMemberRow({
  member,
  actions,
}: {
  member: SceneMember;
  actions?: React.ReactNode;
}) {
  const profile = member.profile;
  const name = profile?.display_name ?? "Unknown artist";

  return (
    <div className="well flex items-center gap-3 rounded-input px-3 py-2.5">
      <ArtistMark
        emblemUrl={profile?.emblem_url ?? null}
        paletteId={profile?.palette_id}
        iceColor={profile?.ice_color}
        amberColor={profile?.amber_color}
        name={name}
        size={32}
        className="size-8 shrink-0"
      />
      <div className="min-w-0 flex-1">
        {profile?.handle ? (
          <Link href={`/artist/${profile.handle}`} className="truncate text-sm text-text-hi hover:underline">
            {name}
          </Link>
        ) : (
          <p className="truncate text-sm text-text-hi">{name}</p>
        )}
        <p className="truncate text-xs text-text-lo">
          {profile?.handle ? `@${profile.handle}` : null}
          {profile?.location ? ` · ${profile.location}` : ""}
        </p>
      </div>
      <span
        className={cn(
          "shrink-0 rounded-chip border px-2 py-0.5 text-xs",
          member.role === "owner"
            ? "border-amber/40 bg-amber/10 text-amber"
            : member.role === "moderator"
              ? "border-ice/40 bg-ice/10 text-ice"
              : "border-line text-text-lo"
        )}
      >
        {ROLE_LABEL[member.role] ?? member.role}
      </span>
      {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
    </div>
  );
}
