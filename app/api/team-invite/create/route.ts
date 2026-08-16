import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createMemberInvite } from "@/lib/team/create-member-invite";
import { noStoreHeaders } from "@/lib/team-invite-server";
import type { MemberRole } from "@/lib/team/roles";
import type { AreaGrants } from "@/lib/team/areas";

export const dynamic = "force-dynamic";

function statusOf(err: unknown): number {
  if (err && typeof err === "object" && "status" in err) {
    const value = (err as { status?: unknown }).status;
    if (typeof value === "number") return value;
  }
  return 500;
}

/**
 * POST /api/team-invite/create — owner invites by email, handle, or profile.
 * Existing TEMPO accounts get an in-app notification to approve; everyone
 * else still gets the email / copyable link.
 */
export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401, headers: noStoreHeaders() });
  }

  const body = await req.json().catch(() => null);
  const artistId = typeof body?.artistId === "string" ? body.artistId : "";
  const role = typeof body?.role === "string" ? body.role : "";
  if (!artistId || !role) {
    return NextResponse.json(
      { error: "Artist and role are required." },
      { status: 400, headers: noStoreHeaders() }
    );
  }

  try {
    const result = await createMemberInvite(createAdminClient(), {
      artistId,
      role: role as MemberRole,
      invitedByUserId: user.id,
      invitedByEmail: user.email ?? null,
      email: typeof body?.email === "string" ? body.email : null,
      handle: typeof body?.handle === "string" ? body.handle : null,
      profileId: typeof body?.profileId === "string" ? body.profileId : null,
      areaOverrides:
        body?.areaOverrides && typeof body.areaOverrides === "object"
          ? (body.areaOverrides as AreaGrants)
          : undefined,
      relationshipLabel: typeof body?.relationshipLabel === "string" ? body.relationshipLabel : null,
      inviteMessage: typeof body?.inviteMessage === "string" ? body.inviteMessage : null,
    });
    return NextResponse.json(result, { status: 201, headers: noStoreHeaders() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Couldn’t send that invite.";
    return NextResponse.json({ error: message }, { status: statusOf(err), headers: noStoreHeaders() });
  }
}
