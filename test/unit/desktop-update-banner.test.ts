import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(path), "utf8");

describe("desktop update banner", () => {
  const banner = read("components/desktop/update-banner.tsx");
  const shell = read("components/app-shell.tsx");
  const main = read("electron/main.js");
  const buildRoute = read("app/api/app-build/route.ts");
  const webRefresh = read("components/desktop/web-release-refresh.tsx");
  const providers = read("components/providers.tsx");
  const policy = read("docs/WEB-DESKTOP-RELEASE-POLICY.md");

  it("prompts only for a ready native shell install", () => {
    expect(banner).toContain("A TEMPO app update is ready.");
    expect(banner).toContain("Update now");
    expect(banner).toContain("After this session");
    expect(banner).toContain("nativeUpdateReady");
    expect(banner).toContain("installDesktopUpdate");
    expect(banner).not.toContain("webUpdateReady");
    expect(banner).not.toContain("APP_VERSION");
    expect(banner).not.toContain("/api/app-build");
  });

  it("is desktop-only and remains outside distraction-free focus sessions", () => {
    expect(banner).toContain("isDesktopApp()");
    expect(banner).toContain("!isDesktopApp()");
    expect(shell.indexOf("FOCUS_ROUTE.test(pathname)")).toBeLessThan(
      shell.indexOf("<DesktopUpdateBanner />")
    );
  });

  it("checks and downloads native updates without an operating-system prompt", () => {
    expect(main).toContain("autoUpdater.checkForUpdates()");
    expect(main).not.toContain("checkForUpdatesAndNotify");
    expect(main).toContain('autoUpdater.on("update-downloaded"');
    expect(main).toContain("autoUpdater.quitAndInstall(false, true)");
  });

  it("keeps the app-build probe for other callers without wiring it to the banner", () => {
    expect(buildRoute).toContain("VERCEL_GIT_COMMIT_SHA");
    expect(buildRoute).toContain('"Cache-Control": "no-store, max-age=0"');
    expect(policy).toContain("native shell");
    expect(policy).toContain("do **not** show this banner");
    expect(policy).not.toContain("same desktop-only in-app banner used for a newly deployed web version");
    expect(policy).toContain("driven only by a downloaded native shell update");
  });

  it("refreshes a stale live web build when the artist returns to Desktop", () => {
    expect(webRefresh).toContain("isDesktopApp()");
    expect(webRefresh).toContain("/api/app-build");
    expect(webRefresh).toContain("APP_VERSION");
    expect(webRefresh).toContain('window.addEventListener("focus"');
    expect(webRefresh).toContain('document.addEventListener("visibilitychange"');
    expect(webRefresh).toContain("window.location.reload()");
    expect(providers).toContain("<DesktopWebReleaseRefresh />");
    expect(policy).toContain("when the artist returns");
  });
});
