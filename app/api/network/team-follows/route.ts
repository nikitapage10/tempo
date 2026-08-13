import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { connectTeamNetworkFollows } from "@/lib/social/connect-team-follows";

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
    await connectTeamNetworkFollows(createAdminClient(), user.id);
  } catch (error) {
    console.error("[network/team-follows] connect pending", error);
    return NextResponse.json({ ok: false }, { status: 500, headers });
  }

  return NextResponse.json({ ok: true }, { headers });
}
