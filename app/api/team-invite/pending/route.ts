import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import {
  listPendingTeamInvitesForUser,
  noStoreHeaders,
} from "@/lib/team-invite-server";

export const dynamic = "force-dynamic";

/** GET /api/team-invite/pending — invites waiting on the signed-in person. */
export async function GET() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401, headers: noStoreHeaders() });
  }

  const invites = await listPendingTeamInvitesForUser(user.id);
  return NextResponse.json({ invites }, { headers: noStoreHeaders() });
}
