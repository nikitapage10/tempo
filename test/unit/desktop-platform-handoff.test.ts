import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(path), "utf8");

describe("web and desktop platform handoff", () => {
  const button = read("components/desktop/download-button.tsx");
  const shell = read("components/app-shell.tsx");
  const main = read("electron/main.js");
  const desktopPackage = read("electron/package.json");

  it("puts the platform action immediately above Settings in the rail", () => {
    const action = shell.indexOf("<DownloadButton />");
    const settings = shell.indexOf('href="/settings"', action);
    const toolbar = shell.indexOf('data-tour="global-search"');

    expect(action).toBeGreaterThan(-1);
    expect(settings).toBeGreaterThan(action);
    expect(action).toBeLessThan(toolbar);
    expect(shell.indexOf("<DownloadButton />", action + 1)).toBe(-1);
  });

  it("offers reciprocal labels and preserves the current path", () => {
    expect(button).toContain('"Open in desktop"');
    expect(button).toContain('"Open web app"');
    expect(button).toContain("tempo://open?path=");
    expect(button).toContain("`${getSiteUrl()}${pathname}`");
    expect(button).toContain("DESKTOP_LINK_MIN_VERSION = [0, 100, 10]");
  });

  it("registers and handles the installed app protocol", () => {
    expect(main).toContain('const APP_PROTOCOL = "tempo"');
    expect(main).toContain("app.setAsDefaultProtocolClient(APP_PROTOCOL");
    expect(main).toContain('app.on("open-url"');
    expect(main).toContain('app.on("second-instance"');
    expect(main).toContain("appLinkDestination(pendingAppLink) || APP_URL");
    expect(desktopPackage).toContain('"schemes"');
    expect(desktopPackage).toContain('"tempo"');
  });
});
