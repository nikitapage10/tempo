import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { isAllowedDesktopNavigation } = require(
  resolve("electron/oauth-navigation.js")
);

const ORIGINS = ["https://tempo-ten-sigma.vercel.app"];

describe("desktop OAuth navigation allowlist", () => {
  it("keeps TEMPO, Supabase, Google, and Microsoft inside the app", () => {
    expect(
      isAllowedDesktopNavigation(
        "https://tempo-ten-sigma.vercel.app/auth/callback?code=x",
        ORIGINS
      )
    ).toBe(true);
    expect(
      isAllowedDesktopNavigation(
        "https://abcdefgh.supabase.co/auth/v1/authorize?provider=google",
        ORIGINS
      )
    ).toBe(true);
    expect(
      isAllowedDesktopNavigation(
        "https://accounts.google.com/o/oauth2/v2/auth",
        ORIGINS
      )
    ).toBe(true);
    expect(
      isAllowedDesktopNavigation(
        "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
        ORIGINS
      )
    ).toBe(true);
    expect(
      isAllowedDesktopNavigation("https://login.live.com/oauth20_authorize.srf", ORIGINS)
    ).toBe(true);
  });

  it("still opens unrelated sites in the system browser", () => {
    expect(
      isAllowedDesktopNavigation("https://example.com/phishing", ORIGINS)
    ).toBe(false);
    expect(
      isAllowedDesktopNavigation("https://evil.notgoogle.com/x", ORIGINS)
    ).toBe(false);
  });

  it("wires the allowlist into the Electron shell and packages the helper", () => {
    const main = readFileSync(resolve("electron/main.js"), "utf8");
    const pkg = readFileSync(resolve("electron/package.json"), "utf8");
    const oauth = readFileSync(
      resolve("components/auth/oauth-buttons.tsx"),
      "utf8"
    );
    expect(main).toContain("isAllowedDesktopNavigation");
    expect(main).toContain("guardRendererNavigation");
    expect(main).toContain("web-contents-created");
    expect(pkg).toContain("oauth-navigation.js");
    expect(pkg).toContain('"0.100.15"');
    expect(oauth).toContain("setPending(null)");
    expect(oauth).toContain("12_000");
  });
});
