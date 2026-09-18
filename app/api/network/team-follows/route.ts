import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { connectTeamNetworkFollows } from "@/lib/social/connect-team-follows";
import {
  ensureOwnerDemoMutualFollows,
  findDemoArtist,
} from "@/lib/demo/seed";

export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "private, no-store" };

/** Backfill mutual follows with artists you work with (and teammates, if you are the artist). */
export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401, headers });
  }

  try {
    const admin = createAdminClient();
    await connectTeamNetworkFollows(admin, user.id);
    // Same visit that wires team follows also puts PRESIDENT on your graph
    // when you already have the demo — so Social → Follows updates without
    // needing another Explore demo click.
    const demo = await findDemoArtist(supabase);
    if (demo) {
      await ensureOwnerDemoMutualFollows(admin, demo.artistId, user.id);
    }
  } catch (error) {
    console.error("[network/team-follows] connect pending", error);
    return NextResponse.json({ ok: false }, { status: 500, headers });
  }

  return NextResponse.json({ ok: true }, { headers });
}
