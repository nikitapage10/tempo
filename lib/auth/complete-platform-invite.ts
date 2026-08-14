import { PREFER_ORIGIN_ARTIST_KEY } from "@/lib/constants";
import { writeStoredArtistId } from "@/lib/auth/workspace-memory";
import { createClient } from "@/lib/supabase/client";

export type CompletedPlatformInvite = {
  startOrigin: boolean;
  startPassage: boolean;
  originArtistId: string | null;
};

function rememberOriginArtist(id: string, userId?: string | null) {
  try {
    sessionStorage.setItem(PREFER_ORIGIN_ARTIST_KEY, id);
  } catch {
    /* ignore */
  }
  writeStoredArtistId(userId ?? null, id);
}

/**
 * Apply a program invite to the signed-in session. Existing team-member
 * accounts become artists on the same login and are pointed at Origin.
 */
export async function completePlatformInvite(
  code: string
): Promise<CompletedPlatformInvite> {
  const redeemRes = await fetch("/api/auth/redeem-invite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  const body = await redeemRes.json().catch(() => null);
  if (!redeemRes.ok) {
    throw new Error(body?.error ?? "Couldn’t apply that invite.");
  }
  const originArtistId =
    typeof body?.originArtistId === "string" ? body.originArtistId : null;
  if (originArtistId) {
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    rememberOriginArtist(originArtistId, data.user?.id ?? null);
  }
  return {
    startOrigin: Boolean(body?.startOrigin),
    startPassage: Boolean(body?.startPassage),
    originArtistId,
  };
}
