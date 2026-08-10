import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolvePreferenceToken, suppress } from "@/lib/pulse/suppression";

export const dynamic = "force-dynamic";

const GENERIC_PAGE = (message: string) =>
  `<!doctype html><html><body style="margin:0;background:#0A0A0C;color:#F2F0EB;font-family:Inter,Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh"><div style="max-width:420px;padding:32px;text-align:center"><div style="font-family:'Space Grotesk',Arial,sans-serif;font-size:20px;font-weight:700;margin-bottom:16px">TEMPO</div><p style="color:#D7D6DC;font-size:15px;line-height:1.6">${message}</p></div></body></html>`;

/**
 * GET /api/email/unsubscribe/[token] — no-sign-in, token-scoped. Disables
 * optional email only; cannot read or change granular preferences, and
 * responds identically for valid/invalid/already-used tokens to avoid an
 * account-existence oracle (02-TECHNICAL-AND-DATA-DESIGN.md §7/§10).
 */
export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const admin = createAdminClient();
  const userId = await resolvePreferenceToken(admin, params.token);

  if (userId) {
    await admin.from("notification_preferences").update({ digest_frequency: "off", email_pulse_enabled: false }).eq("user_id", userId);
    const { data: authUser } = await admin.auth.admin.getUserById(userId);
    if (authUser?.user?.email) {
      await suppress(admin, { userId, email: authUser.user.email, reason: "unsubscribe" });
    }
  }

  return new NextResponse(
    GENERIC_PAGE("You’re unsubscribed from TEMPO Pulse email. In-app updates keep working as usual."),
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } }
  );
}
