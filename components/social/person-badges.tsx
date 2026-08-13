import { ROLE_LABELS, type MemberRole } from "@/lib/team/roles";
import type { NetworkPersonBadges } from "@/lib/api/network-badges";

export function PersonBadges({ badges }: { badges: NetworkPersonBadges | undefined }) {
  if (!badges) return null;
  const chips: string[] = [];
  if (badges.isArtist) chips.push("Artist");
  for (const hat of badges.hats) {
    const role = ROLE_LABELS[hat.role as MemberRole] ?? hat.role;
    chips.push(`${role} for ${hat.artistName}`);
  }
  if (chips.length === 0) return null;
  return (
    <span className="mt-0.5 flex flex-wrap gap-1">
      {chips.map((chip) => (
        <span
          key={chip}
          className="rounded-chip border border-line px-1.5 py-0.5 text-[10px] text-text-lo"
        >
          {chip}
        </span>
      ))}
    </span>
  );
}
