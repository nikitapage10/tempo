import { describe, expect, it } from "vitest";
import {
  inviteLoginHref,
  inviteRegisterHref,
  isSafeRedirect,
  parseInviteRedirect,
} from "@/lib/auth/invite-signup";

describe("parseInviteRedirect", () => {
  it("reads a team invite token out of the post-auth redirect", () => {
    expect(parseInviteRedirect("/team-invite/abc123def456abc123")).toEqual({
      kind: "team",
      token: "abc123def456abc123",
    });
  });

  it("reads a track invite token out of the post-auth redirect", () => {
    expect(parseInviteRedirect("/invite/ffffffffffffffff")).toEqual({
      kind: "track",
      token: "ffffffffffffffff",
    });
  });

  it("rejects open redirects and unrelated paths", () => {
    expect(parseInviteRedirect(null)).toBeNull();
    expect(parseInviteRedirect("//evil.example/team-invite/x")).toBeNull();
    expect(parseInviteRedirect("/login")).toBeNull();
    expect(parseInviteRedirect("/team-invite/")).toBeNull();
    expect(parseInviteRedirect("/invite")).toBeNull();
  });
});

describe("invite auth hrefs", () => {
  it("keeps the redirect and pre-fills the invited email on sign-in", () => {
    expect(inviteLoginHref("/team-invite/tok", "mgr@studio.com")).toBe(
      "/login?redirect=%2Fteam-invite%2Ftok&email=mgr%40studio.com"
    );
    expect(inviteRegisterHref("/team-invite/tok")).toBe(
      "/register?redirect=%2Fteam-invite%2Ftok"
    );
  });
});

describe("isSafeRedirect", () => {
  it("allows in-app paths only", () => {
    expect(isSafeRedirect("/team-invite/tok")).toBe(true);
    expect(isSafeRedirect("//evil")).toBe(false);
    expect(isSafeRedirect("https://evil.example")).toBe(false);
  });
});
