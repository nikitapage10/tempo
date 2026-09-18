import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  collectOAuthAccountSignals,
  decideOAuthAccess,
  oauthProviderOf,
} from "@/lib/auth/oauth-access";

export const dynamic = "force-dynamic";
const headers: HeadersInit = { "Cache-Control": "no-store" };

const REFUSED =
  "TEMPO is invite-only right now. Google and Microsoft sign-in works once your account exists — create it with your invite code first.";

/**
 * POST /api/auth/oauth-gate — called by /auth/callback immediately after a
 * Google / Microsoft code exchange, before the app loads.
 *
 * Supabase OAuth creates a user when the provider account is new, so this is
 * where an uninvited provider signup is refused: the session is signed out and
 * the just-created auth account is removed. Refusal happens on every callback,
 * so removal is only housekeeping — a refused account can never enter the app
 * even if the delete fails.
 *
 * Email/password accounts skip the check: they already passed the invite gate
 * on /register.
 */
export async function POST() {
  const session = createServerClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { allowed: false, error: "Sign in first." },
      { status: 401, headers }
    );
  }

  if (oauthProviderOf(user) === "email") {
    return NextResponse.json(
      { allowed: true, reason: "password_account" },
      { headers }
    );
  }

  let decision;
  try {
    decision = decideOAuthAccess(await collectOAuthAccountSignals(user));
  } catch {
    // Fail closed: an unverifiable provider sign-in does not get in.
    decision = {
      allowed: false as const,
      deleteAccount: false,
      reason: "signal_error",
    };
  }

  if (decision.allowed) {
    if (decision.redeemInviteId) {
      try {
        await createAdminClient().rpc("redeem_platform_invite", {
          p_invite_id: decision.redeemInviteId,
          p_user_id: user.id,
        });
      } catch {
        // Recording how they joined is bookkeeping; don't block a valid member.
      }
    }
    return NextResponse.json(
      { allowed: true, reason: decision.reason },
      { headers }
    );
  }

  try {
    await session.auth.signOut();
  } catch {
    /* the client signs out too */
  }

  if (decision.deleteAccount) {
    try {
      await createAdminClient().auth.admin.deleteUser(user.id);
    } catch {
      /* refusal already stands; the account stays for admin review */
    }
  }

  return NextResponse.json(
    { allowed: false, error: REFUSED, reason: decision.reason },
    { status: 403, headers }
  );
}
