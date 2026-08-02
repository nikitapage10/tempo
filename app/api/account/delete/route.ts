import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/account/delete — self-serve account deletion.
 * Body: { email } must match the signed-in user's email.
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "Sign in to delete your account." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const email =
    typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || email !== user.email.toLowerCase()) {
    return NextResponse.json(
      { error: "Email confirmation does not match." },
      { status: 400 },
    );
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[account/delete]", err);
    return NextResponse.json(
      { error: "Couldn’t delete this account. Try again or contact support." },
      { status: 500 },
    );
  }
}
