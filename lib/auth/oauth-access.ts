/**
 * Provider sign-in must not be a side door into TEMPO.
 *
 * `/register` is invite-only, but Supabase OAuth *creates* a user when the
 * Google / Microsoft account is new — so "Continue with Google" on /login used
 * to mint a working Artist account for anyone who found the page. This module
 * decides, right after the code exchange, whether the signed-in provider
 * account is actually a member of the program.
 *
 * Deliberately generous about what counts as a member: existing accounts
 * predate invite records, so any real evidence of membership (workspace,
 * onboarding, team seat, admin) passes. The only thing it closes is a
 * brand-new account that nobody invited.
 *
 * Server-only — it reads with the service role.
 */
import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * How recently the account must have been created to count as "made by this
 * sign-in". Only accounts inside the window are deleted on refusal, so an
 * established member can never be removed by this gate.
 */
export const FRESH_ACCOUNT_WINDOW_MS = 10 * 60 * 1000;

export type OAuthAccountSignals = {
  createdAtMs: number;
  nowMs: number;
  /** Redeemed one of the admin console's signup codes. */
  hasInviteRedemption: boolean;
  /** Has a member_onboarding row — every account that has actually used TEMPO. */
  hasOnboardingRecord: boolean;
  isPlatformAdmin: boolean;
  /** An accepted artist-team seat or track collaboration. */
  hasAcceptedMembership: boolean;
  /** Owns at least one artist workspace. */
  hasOwnedWorkspace: boolean;
  /** A usable platform invite code bound to this email, not yet redeemed. */
  pendingPlatformInviteId: string | null;
  /** A pending team or track invite addressed to this email. */
  hasPendingMembershipInvite: boolean;
  /** One of the membership lookups failed, so absence proves nothing. */
  lookupFailed: boolean;
};

export type OAuthAccessDecision =
  | { allowed: true; redeemInviteId: string | null; reason: string }
  | { allowed: false; deleteAccount: boolean; reason: string };

/**
 * Pure membership decision. Kept free of I/O so the policy is directly
 * testable — see test/unit/oauth-signin-gate.test.ts.
 */
export function decideOAuthAccess(
  signals: OAuthAccountSignals
): OAuthAccessDecision {
  if (signals.hasInviteRedemption) {
    return { allowed: true, redeemInviteId: null, reason: "invite_redeemed" };
  }
  if (signals.isPlatformAdmin) {
    return { allowed: true, redeemInviteId: null, reason: "platform_admin" };
  }
  if (signals.hasAcceptedMembership) {
    return { allowed: true, redeemInviteId: null, reason: "accepted_membership" };
  }
  if (signals.hasOwnedWorkspace) {
    return { allowed: true, redeemInviteId: null, reason: "existing_workspace" };
  }
  if (signals.hasOnboardingRecord) {
    return { allowed: true, redeemInviteId: null, reason: "existing_member" };
  }

  // Invited, but arriving through Google instead of the coded form. Let them
  // in and record the code so the admin console still shows how they joined.
  if (signals.pendingPlatformInviteId) {
    return {
      allowed: true,
      redeemInviteId: signals.pendingPlatformInviteId,
      reason: "pending_invite",
    };
  }
  if (signals.hasPendingMembershipInvite) {
    return { allowed: true, redeemInviteId: null, reason: "pending_membership_invite" };
  }

  const isFresh = signals.nowMs - signals.createdAtMs <= FRESH_ACCOUNT_WINDOW_MS;

  // Couldn't verify an account that clearly predates this sign-in — assume the
  // established member it looks like rather than locking them out of their work.
  if (signals.lookupFailed && !isFresh) {
    return { allowed: true, redeemInviteId: null, reason: "unverified_existing" };
  }

  return {
    allowed: false,
    // Never delete on an incomplete read, and never delete an older account.
    deleteAccount: isFresh && !signals.lookupFailed,
    reason: isFresh ? "uninvited_new_account" : "uninvited_account",
  };
}

/** Which identity provider signed this session in ("email" for password accounts). */
export function oauthProviderOf(user: User): string {
  return String(
    user.app_metadata?.provider ?? user.identities?.[0]?.provider ?? "email"
  );
}

type InviteRow = {
  id: string;
  expires_at: string | null;
  max_uses: number;
  used_count: number;
  revoked_at: string | null;
};

function usableInvite(row: InviteRow, nowMs: number): boolean {
  if (row.revoked_at) return false;
  if (row.expires_at && new Date(row.expires_at).getTime() <= nowMs) return false;
  return row.used_count < row.max_uses;
}

function configuredAdminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

/** Read every membership signal for this account with the service role. */
export async function collectOAuthAccountSignals(
  user: User
): Promise<OAuthAccountSignals> {
  const service = createAdminClient();
  const email = user.email?.trim().toLowerCase() ?? "";
  const nowMs = Date.now();
  let lookupFailed = false;

  const seen = <T>(result: PromiseSettledResult<{ data: T | null; error: unknown }>) => {
    if (result.status !== "fulfilled" || result.value.error) {
      lookupFailed = true;
      return null;
    }
    return result.value.data;
  };

  const [
    redemption,
    onboarding,
    admin,
    workspace,
    teamSeat,
    trackSeat,
    pendingTeam,
    pendingTrack,
    invites,
  ] = await Promise.allSettled([
    service.from("invite_redemptions").select("user_id").eq("user_id", user.id).limit(1).maybeSingle(),
    service.from("member_onboarding").select("user_id").eq("user_id", user.id).maybeSingle(),
    service.from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle(),
    service.from("artists").select("id").eq("user_id", user.id).limit(1).maybeSingle(),
    service.from("artist_members").select("id").eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle(),
    service.from("track_collaborators").select("id").eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle(),
    email
      ? service.from("artist_members").select("id").ilike("invited_email", email).eq("status", "pending").limit(1).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    email
      ? service.from("track_collaborators").select("id").ilike("invited_email", email).eq("status", "pending").limit(1).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    email
      ? service.from("invites").select("id, expires_at, max_uses, used_count, revoked_at").ilike("email", email)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const inviteRows = (seen(invites) as InviteRow[] | null) ?? [];
  const usable = inviteRows.find((row) => usableInvite(row, nowMs));

  const adminRow = seen(admin);
  const isPlatformAdmin =
    !!adminRow || (!!email && configuredAdminEmails().has(email));

  return {
    createdAtMs: new Date(user.created_at).getTime(),
    nowMs,
    hasInviteRedemption: !!seen(redemption),
    hasOnboardingRecord: !!seen(onboarding),
    isPlatformAdmin,
    hasAcceptedMembership: !!seen(teamSeat) || !!seen(trackSeat),
    hasOwnedWorkspace: !!seen(workspace),
    pendingPlatformInviteId: usable?.id ?? null,
    hasPendingMembershipInvite: !!seen(pendingTeam) || !!seen(pendingTrack),
    lookupFailed,
  };
}
