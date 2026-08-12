import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { isAllowedDesktopNavigation, appLinkDestination } = require(
  resolve("electron/oauth-navigation.js")
);

const ORIGINS = ["https://mytempo.dev"];
const APP_URL = "https://mytempo.dev";

describe("desktop OAuth navigation allowlist", () => {
  it("keeps only the TEMPO origin inside the app (providers use the system browser)", () => {
    expect(
      isAllowedDesktopNavigation(
        "https://mytempo.dev/auth/callback?code=x",
        ORIGINS
      )
    ).toBe(true);
    expect(
      isAllowedDesktopNavigation(
        "https://abcdefgh.supabase.co/auth/v1/authorize?provider=google",
        ORIGINS
      )
    ).toBe(false);
    expect(
      isAllowedDesktopNavigation(
        "https://accounts.google.com/o/oauth2/v2/auth",
        ORIGINS
      )
    ).toBe(false);
    expect(
      isAllowedDesktopNavigation(
        "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
        ORIGINS
      )
    ).toBe(false);
  });

  it("still opens unrelated sites in the system browser", () => {
    expect(
      isAllowedDesktopNavigation("https://example.com/phishing", ORIGINS)
    ).toBe(false);
  });

  it("resolves tempo://auth/callback into the in-app code exchange URL", () => {
    const href = appLinkDestination(
      "tempo://auth/callback?code=abc123&next=%2Fimport",
      APP_URL,
      ORIGINS
    );
    expect(href).toBe(
      "https://mytempo.dev/auth/callback?code=abc123&next=%2Fimport"
    );
    expect(
      appLinkDestination("tempo://open?path=/tracks", APP_URL, ORIGINS)
    ).toBe("https://mytempo.dev/tracks");
    expect(
      appLinkDestination("tempo://auth/callback", APP_URL, ORIGINS)
    ).toBeNull();
  });

  it("accepts Windows-style tempo:// path shapes for the auth handoff", () => {
    expect(
      appLinkDestination(
        "tempo:///auth/callback?code=win1&next=%2F",
        APP_URL,
        ORIGINS
      )
    ).toBe("https://mytempo.dev/auth/callback?code=win1&next=%2F");
    expect(
      appLinkDestination("tempo://callback?code=win2&next=%2F", APP_URL, ORIGINS)
    ).toBe("https://mytempo.dev/auth/callback?code=win2&next=%2F");
  });

  it("wires system-browser OAuth into the shell and login buttons", () => {
    const main = readFileSync(resolve("electron/main.js"), "utf8");
    const pkg = readFileSync(resolve("electron/package.json"), "utf8");
    const oauth = readFileSync(
      resolve("components/auth/oauth-buttons.tsx"),
      "utf8"
    );
    const bridge = readFileSync(
      resolve("app/auth/desktop-bridge/route.ts"),
      "utf8"
    );
    const callbackPage = readFileSync(
      resolve("app/auth/callback/page.tsx"),
      "utf8"
    );
    expect(main).toContain("shell:openExternal");
    expect(main).toContain("resolveAppLinkDestination");
    expect(main).toContain("16_384");
    expect(main).toContain('app.on("second-instance"');
    expect(pkg).toContain("oauth-navigation.js");
    expect(oauth).toContain("skipBrowserRedirect");
    expect(oauth).toContain("canOpenExternal");
    expect(oauth).toContain("/auth/desktop-bridge");
    expect(oauth).toContain("window.location.assign");
    expect(bridge).toContain("tempo://auth/callback");
    expect(bridge).not.toContain("exchangeCodeForSession");
    expect(callbackPage).toContain("exchangeCodeForSession");
    expect(callbackPage).toContain("createClient");
  });
});
