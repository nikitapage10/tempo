import { createClient } from "@/lib/supabase/client";
import type { MemberRole } from "@/lib/team/roles";

export type NetworkHat = {
  role: MemberRole;
  artistName: string;
  artistId: string;
};

export type NetworkPersonBadges = {
  isArtist: boolean;
  artistHandle: string | null;
  artistName: string | null;
  hats: NetworkHat[];
};

const EMPTY: NetworkPersonBadges = {
  isArtist: false,
  artistHandle: null,
  artistName: null,
  hats: [],
};

function isMissingRpc(error: { message?: string }): boolean {
  return /network_person_badges_for|schema cache|does not exist/i.test(
    error?.message ?? ""
  );
}

function parseBadges(raw: unknown): NetworkPersonBadges {
  if (!raw || typeof raw !== "object") return EMPTY;
  const obj = raw as Record<string, unknown>;
  const hatsRaw = Array.isArray(obj.hats) ? obj.hats : [];
  return {
    isArtist: obj.isArtist === true,
    artistHandle: typeof obj.artistHandle === "string" ? obj.artistHandle : null,
    artistName: typeof obj.artistName === "string" ? obj.artistName : null,
    hats: hatsRaw.flatMap((hat) => {
      if (!hat || typeof hat !== "object") return [];
      const h = hat as Record<string, unknown>;
      if (typeof h.role !== "string" || typeof h.artistName !== "string") return [];
      return [
        {
          role: h.role as MemberRole,
          artistName: h.artistName,
          artistId: typeof h.artistId === "string" ? h.artistId : "",
        },
      ];
    }),
  };
}

/** Public hats for Social people cards — empty until migration 092 has run. */
export async function fetchNetworkPersonBadges(
  userIds: string[]
): Promise<Map<string, NetworkPersonBadges>> {
  const map = new Map<string, NetworkPersonBadges>();
  if (userIds.length === 0) return map;
  const supabase = createClient();
  const { data, error } = await supabase.rpc("network_person_badges_for", {
    p_user_ids: userIds,
  });
  if (error) {
    if (isMissingRpc(error)) return map;
    throw new Error(error.message);
  }
  if (!data || typeof data !== "object") return map;
  for (const [userId, raw] of Object.entries(data as Record<string, unknown>)) {
    map.set(userId, parseBadges(raw));
  }
  return map;
}
