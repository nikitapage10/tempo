import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  platformInviteLoginHref,
  platformInviteWelcomeHref,
} from "@/lib/auth/invite-signup";

const read = (path: string) => readFileSync(resolve(path), "utf8");

describe("team member artist-invite upgrade", () => {
  it("sends existing accounts from the artist invite link to sign-in", () => {
    expect(platformInviteLoginHref("TEMPO-ABCD-EFGH", "music@nikita.page")).toBe(
      "/login?invite=TEMPO-ABCD-EFGH&email=music%40nikita.page"
    );
    expect(platformInviteWelcomeHref("TEMPO-ABCD-EFGH")).toBe(
      "/welcome?invite=TEMPO-ABCD-EFGH"
    );
    const register = read("app/register/page.tsx");
    expect(register).toContain("accountExists");
    expect(register).toContain("platformInviteLoginHref");
    const login = read("app/login/page.tsx");
    expect(login).toContain("completePlatformInvite");
    expect(login).toContain("startOrigin");
  });

  it("redeems an artist invite onto the signed-in account and starts Origin", () => {
    const redeem = read("app/api/auth/redeem-invite/route.ts");
    expect(redeem).toContain("ensureOriginArtistForInvite");
    expect(redeem).toContain("That invite was sent to a different email.");
    const ensure = read("lib/auth/ensure-origin-artist.ts");
    expect(ensure).toContain("workspace_kind");
    expect(ensure).toContain("not_started");
    const layout = read("app/(app)/layout.tsx");
    expect(layout).toContain("hasPersonalHome");
    const provider = read("components/active-artist-provider.tsx");
    expect(provider).toContain("PREFER_ORIGIN_ARTIST_KEY");
  });

  it("does not drop a signed-in artist invite onto Today", () => {
    const middleware = read("lib/supabase/middleware.ts");
    expect(middleware).toContain('pathname = "/welcome"');
    expect(middleware).toContain("invite");
  });

  it("verify-invite reports whether that email already has an account", () => {
    const verify = read("app/api/auth/verify-invite/route.ts");
    expect(verify).toContain("authAccountExistsForEmail");
    expect(verify).toContain("accountExists");
  });
});
