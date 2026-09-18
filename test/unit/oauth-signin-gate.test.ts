import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  FRESH_ACCOUNT_WINDOW_MS,
  decideOAuthAccess,
  oauthProviderOf,
  type OAuthAccountSignals,
} from "@/lib/auth/oauth-access";

const NOW = 1_800_000_000_000;

function signals(over: Partial<OAuthAccountSignals> = {}): OAuthAccountSignals {
  return {
    createdAtMs: NOW - 1_000,
    nowMs: NOW,
    hasInviteRedemption: false,
    hasOnboardingRecord: false,
    isPlatformAdmin: false,
    hasAcceptedMembership: false,
    hasOwnedWorkspace: false,
    pendingPlatformInviteId: null,
    hasPendingMembershipInvite: false,
    lookupFailed: false,
    ...over,
  };
}

describe("provider sign-in membership gate", () => {
  it("refuses a brand-new provider account nobody invited, and removes it", () => {
    expect(decideOAuthAccess(signals())).toEqual({
      allowed: false,
      deleteAccount: true,
      reason: "uninvited_new_account",
    });
  });

  it("lets every kind of existing member through", () => {
    for (const key of [
      "hasInviteRedemption",
      "hasOnboardingRecord",
      "isPlatformAdmin",
      "hasAcceptedMembership",
      "hasOwnedWorkspace",
    ] as const) {
      const decision = decideOAuthAccess(signals({ [key]: true }));
      expect(decision.allowed, key).toBe(true);
      if (decision.allowed) expect(decision.redeemInviteId).toBeNull();
    }
  });

  it("admits an invited person who used Google instead of the coded form, and records the code", () => {
    const decision = decideOAuthAccess(
      signals({ pendingPlatformInviteId: "invite-1" })
    );
    expect(decision).toEqual({
      allowed: true,
      redeemInviteId: "invite-1",
      reason: "pending_invite",
    });
  });

  it("admits someone holding a pending team or track invite without redeeming a code", () => {
    expect(decideOAuthAccess(signals({ hasPendingMembershipInvite: true }))).toEqual({
      allowed: true,
      redeemInviteId: null,
      reason: "pending_membership_invite",
    });
  });

  it("never deletes an account older than the fresh-signup window", () => {
    const decision = decideOAuthAccess(
      signals({ createdAtMs: NOW - FRESH_ACCOUNT_WINDOW_MS - 1 })
    );
    expect(decision).toEqual({
      allowed: false,
      deleteAccount: false,
      reason: "uninvited_account",
    });
  });

  it("keeps an established member signed in when the membership lookup fails", () => {
    const decision = decideOAuthAccess(
      signals({ createdAtMs: NOW - 90 * 24 * 3_600_000, lookupFailed: true })
    );
    expect(decision.allowed).toBe(true);
  });

  it("still refuses a fresh account when the lookup fails, but does not delete it", () => {
    expect(decideOAuthAccess(signals({ lookupFailed: true }))).toEqual({
      allowed: false,
      deleteAccount: false,
      reason: "uninvited_new_account",
    });
  });

  it("reads the provider off the auth account, defaulting to email", () => {
    expect(
      oauthProviderOf({ app_metadata: { provider: "google" } } as never)
    ).toBe("google");
    expect(
      oauthProviderOf({ app_metadata: {}, identities: [{ provider: "azure" }] } as never)
    ).toBe("azure");
    expect(oauthProviderOf({ app_metadata: {} } as never)).toBe("email");
  });
});

describe("gate wiring", () => {
  const read = (path: string) => readFileSync(resolve(path), "utf8");

  it("checks membership in the callback before the app loads, and signs out on refusal", () => {
    const callback = read("app/auth/callback/page.tsx");
    expect(callback).toContain("/api/auth/oauth-gate");
    expect(callback).toContain("signOutOfTempo(\"/login?error=not_invited\")");
    // The pass must be explicit — a failed check cannot fall through to the app.
    expect(callback).toContain("let allowed = false");
  });

  it("keeps the refusal server-side, with service-role removal of a new account", () => {
    const route = read("app/api/auth/oauth-gate/route.ts");
    expect(route).toContain("collectOAuthAccountSignals");
    expect(route).toContain("decideOAuthAccess");
    expect(route).toContain("auth.admin.deleteUser");
    expect(route).toContain("redeem_platform_invite");
    // Password accounts already passed the invite-coded /register form.
    expect(route).toContain('oauthProviderOf(user) === "email"');
  });

  it("explains the refusal on the sign-in screen", () => {
    expect(read("app/login/page.tsx")).toContain("not_invited");
  });
});
