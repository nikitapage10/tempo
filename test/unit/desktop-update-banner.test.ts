import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(path), "utf8");

describe("desktop update banner", () => {
  const banner = read("components/desktop/update-banner.tsx");
  const shell = read("components/app-shell.tsx");
  const main = read("electron/main.js");
  const buildRoute = read("app/api/app-build/route.ts");

  it("presents one update message with the two approved actions", () => {
    expect(banner).toContain("A TEMPO update is available.");
    expect(banner).toContain("Update now");
    expect(banner).toContain("After this session");
  });

  it("is desktop-only and remains outside distraction-free focus sessions", () => {
    expect(banner).toContain("isDesktopApp()");
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

  it("uses the current deployment fingerprint without caching it", () => {
    expect(banner).toContain("result.version !== APP_VERSION");
    expect(buildRoute).toContain("VERCEL_GIT_COMMIT_SHA");
    expect(buildRoute).toContain('"Cache-Control": "no-store, max-age=0"');
  });
});
