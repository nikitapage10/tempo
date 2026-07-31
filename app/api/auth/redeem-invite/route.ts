import { type NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
const headers: HeadersInit = { "Cache-Control": "no-store" };

export async function POST(req: NextRequest) {
  const session = createServerClient(); const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401, headers });
  const body = await req.json().catch(() => null); const inviteId = typeof body?.inviteId === "string" ? body.inviteId : "";
  if (!inviteId) return NextResponse.json({ ok: true }, { headers });
  try {
    const { data, error } = await createAdminClient().rpc("redeem_platform_invite", { p_invite_id: inviteId, p_user_id: user.id });
    if (error || data !== true) return NextResponse.json({ error: "That invite is no longer available." }, { status: 409, headers });
    return NextResponse.json({ ok: true }, { headers });
  } catch { return NextResponse.json({ error: "Couldn’t redeem the invite." }, { status: 500, headers }); }
}
