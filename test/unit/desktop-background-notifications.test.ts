import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("desktop background notifications", () => {
  const main = read("electron/main.js");
  const preload = read("electron/preload.js");
  const desktopPackage = JSON.parse(read("electron/package.json"));
  const inbox = read("hooks/use-realtime-inbox.ts");

  it("keeps realtime delivery awake and close-to-tray independent of file sync", () => {
    expect(main).toContain("backgroundThrottling: false");
    expect(main).toContain("disable-renderer-backgrounding");
    expect(main).toContain("disable-background-timer-throttling");
    expect(main).toContain('mainWindow.on("close"');
    expect(main).toContain("if (quitting) return;");
    expect(main).not.toContain("if (quitting || !syncEnabled) return;");
  });

  it("exposes a visible glass toast with sound when TEMPO is in the background", () => {
    expect(main).toContain("app.setAppUserModelId(APP_USER_MODEL_ID)");
    expect(main).toContain("showGlassNotification");
    expect(main).toContain("shouldShowDesktopAlert");
    expect(main).toContain('setAlwaysOnTop(true, "screen-saver")');
    expect(main).toContain("popup.show()");
    expect(main).not.toContain('backgroundMaterial: "acrylic"');
    expect(main).toContain('ipcMain.handle("notifications:show"');
    expect(preload).toContain('ipcRenderer.invoke("notifications:show"');
    expect(inbox).toContain("showDesktopNotification");
    expect(inbox).toContain("showWebGlassAlert");
    expect(inbox).toContain("playIncomingAlert");
  });

  it("tints glass alerts from the active artist palette and stays quiet on Messages", () => {
    expect(inbox).toContain("useActiveArtistPalette");
    expect(inbox).toContain("normalizeAccentHex");
    expect(inbox).toContain("isMessagesSurface");
    expect(inbox).toContain('alertKind === "message" && isMessagesSurface');
    expect(inbox).toContain("router.push(link)");
    expect(main).toContain("iceHex");
    expect(main).toContain("amberHex");
  });

  it("packages the TEMPO emblem and tray icons for the shell", () => {
    expect(desktopPackage.build.extraResources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: "../public/tempo-emblem.png",
          to: "assets/tempo-icon.png",
        }),
        expect.objectContaining({
          from: "../public/tempo-icon.ico",
          to: "assets/tempo-icon.ico",
        }),
      ])
    );
    expect(main).toContain("tempo-tray-32.png");
  });
});
