import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  pickActiveDesktopDevice,
  resolveDesktopHandoff,
  supportsDesktopLink,
} from "@/lib/desktop/handoff";

const read = (path: string) => readFileSync(resolve(path), "utf8");

describe("web and desktop platform handoff", () => {
  const button = read("components/desktop/download-button.tsx");
  const shell = read("components/app-shell.tsx");
  const main = read("electron/main.js");
  const desktopPackage = read("electron/package.json");
  const register = read("app/register/page.tsx");
  const welcome = read("app/welcome/page.tsx");

  it("puts the platform action immediately above Settings in the rail", () => {
    const action = shell.indexOf("<DownloadButton />");
    const settings = shell.indexOf('href="/settings"', action);
    const toolbar = shell.indexOf('data-tour="global-search"');

    expect(action).toBeGreaterThan(-1);
    expect(settings).toBeGreaterThan(action);
    expect(action).toBeLessThan(toolbar);
    expect(shell.indexOf("<DownloadButton />", action + 1)).toBe(-1);
  });

  it("uses the shared handoff on the Download page", () => {
    const downloadPage = read("app/download/page.tsx");
    expect(downloadPage).toContain("resolveDesktopHandoff");
    expect(downloadPage).toContain("open-desktop");
    expect(downloadPage).toContain("update-desktop");
  });

  it("offers reciprocal labels and preserves the current path", () => {
    expect(button).toContain("resolveDesktopHandoff");
    expect(read("lib/desktop/handoff.ts")).toContain('"Open in desktop"');
    expect(read("lib/desktop/handoff.ts")).toContain('"Open web app"');
    expect(desktopPackage).toContain('"schemes"');
    expect(desktopPackage).toContain('"tempo"');
  });

  it("registers and handles the installed app protocol", () => {
    expect(main).toContain('const APP_PROTOCOL = "tempo"');
    expect(main).toContain("app.setAsDefaultProtocolClient(APP_PROTOCOL");
    expect(main).toContain('app.on("open-url"');
    expect(main).toContain('app.on("second-instance"');
    expect(main).toContain("appLinkDestination(pendingAppLink) || APP_URL");
    expect(main).toContain("process.exit(0)");
    expect(desktopPackage).toContain("tempo-icon.ico");
  });

  it("sends fresh invite signups to the web-vs-desktop welcome chooser", () => {
    expect(register).toContain('"/welcome"');
    expect(welcome).toContain("Continue in the browser");
    expect(welcome).toContain("Download for Windows");
    expect(welcome).toContain('href="/origin"');
  });

  it("resolves open vs update vs download from device state", () => {
    expect(supportsDesktopLink("0.100.10")).toBe(true);
    expect(supportsDesktopLink("0.100.6")).toBe(false);
    expect(supportsDesktopLink("v0.100.11")).toBe(true);

    const open = resolveDesktopHandoff({
      isDesktop: false,
      pathname: "/tracks",
      activeDevice: {
        id: "d1",
        app_version: "0.100.11",
        last_seen_at: new Date().toISOString(),
      },
      webAppUrl: "https://tempo-ten-sigma.vercel.app",
      windowsInstallerUrl: "/downloads/TEMPO-Setup.exe",
    });
    expect(open.kind).toBe("open-desktop");
    expect(open.href).toContain("tempo://open?path=");

    const stale = resolveDesktopHandoff({
      isDesktop: false,
      pathname: "/download",
      activeDevice: {
        id: "d1",
        app_version: "0.100.6",
        last_seen_at: new Date().toISOString(),
      },
      webAppUrl: "https://tempo-ten-sigma.vercel.app",
      windowsInstallerUrl: "/downloads/TEMPO-Setup.exe",
    });
    // Stale DB version still opens desktop; Update stays a secondary path.
    expect(stale.kind).toBe("open-desktop");
    expect(stale.label).toBe("Open in desktop");
    expect(stale.secondaryLabel).toBe("Update TEMPO");
  });

  it("prefers a link-capable install over a newer-seen old build", () => {
    const now = Date.parse("2026-08-12T00:00:00.000Z");
    const picked = pickActiveDesktopDevice(
      [
        {
          id: "old",
          app_version: "0.100.6",
          last_seen_at: "2026-08-11T23:00:00.000Z",
        },
        {
          id: "new",
          app_version: "0.100.11",
          last_seen_at: "2026-08-11T12:00:00.000Z",
        },
      ],
      now
    );
    expect(picked?.id).toBe("new");
  });

  it("defaults Windows download to the stable API that prefers the public channel", () => {
    expect(read("lib/desktop/handoff.ts")).toContain("/api/desktop/windows");
    expect(read("lib/desktop/handoff.ts")).toContain(
      "/downloads/TEMPO-Setup-0.100.6.exe"
    );
    expect(read("lib/desktop/handoff.ts")).toContain(
      "tempo-desktop-releases/releases/download/v"
    );
    expect(read("lib/desktop/handoff.ts")).toContain('DESKTOP_SHELL_VERSION = "');
    expect(button).toContain("DESKTOP_WINDOWS_INSTALLER_URL");
    expect(existsSync(resolve("app/api/desktop/windows/route.ts"))).toBe(true);
    expect(existsSync(resolve("app/api/desktop/mac/route.ts"))).toBe(true);
  });

  it("ships an assisted Spectra-branded Windows install wizard", () => {
    const desktop = read("electron/package.json");
    expect(desktop).toContain('"oneClick": false');
    expect(desktop).toContain('"allowToChangeInstallationDirectory": true');
    expect(desktop).toContain("installerSidebar.bmp");
    expect(desktop).toContain("media-permissions.js");
    expect(existsSync(resolve("electron/build/installerSidebar.bmp"))).toBe(true);
    expect(existsSync(resolve("electron/build/installer.nsh"))).toBe(true);
    expect(existsSync(resolve("electron/media-permissions.js"))).toBe(true);
    expect(read("electron/build/installer.nsh")).toContain("customWelcomePage");
    expect(read("electron/build/installer.nsh")).toContain("Welcome to TEMPO");
    expect(read("electron/build/installer.nsh")).not.toContain("TEMPO Desktop");
    expect(existsSync(resolve("scripts/generate-installer-branding.ps1"))).toBe(true);
  });

  it("exposes a stable unsigned Mac DMG on the public release channel", () => {
    expect(read("lib/desktop/handoff.ts")).toContain(
      "/TEMPO-Mac.dmg"
    );
    expect(read("lib/desktop/handoff.ts")).toContain("/api/desktop/mac");
    expect(read("electron/package.json")).toContain('"identity": null');
    expect(read("electron/package.json")).toContain("TEMPO-Mac.${ext}");
    expect(read(".github/workflows/desktop-release.yml")).toContain("macos-latest");
    expect(read(".github/workflows/desktop-release.yml")).toContain(
      "CSC_IDENTITY_AUTO_DISCOVERY"
    );
  });

  it("publishes desktop builds on electron main pushes and a daily catch-up", () => {
    const workflow = read(".github/workflows/desktop-release.yml");
    expect(workflow).toContain("schedule:");
    expect(workflow).toContain('cron: "0 14 * * *"');
    expect(workflow).toContain("push:");
    expect(workflow).toContain("electron/**");
    expect(workflow).toContain("should-publish");
  });
});
