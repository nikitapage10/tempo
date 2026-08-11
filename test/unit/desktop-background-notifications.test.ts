import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("desktop background notifications", () => {
  const main = read("electron/main.js");
  const preload = read("electron/preload.js");
  const desktopPackage = JSON.parse(read("electron/package.json"));

  it("keeps realtime delivery awake and close-to-tray independent of file sync", () => {
    expect(main).toContain("backgroundThrottling: false");
    expect(main).toContain('mainWindow.on("close"');
    expect(main).toContain("if (quitting) return;");
    expect(main).not.toContain("if (quitting || !syncEnabled) return;");
  });

  it("exposes native alerts with a stable Windows identity", () => {
    expect(main).toContain("app.setAppUserModelId(APP_USER_MODEL_ID)");
    expect(main).toContain("new NativeNotification");
    expect(main).toContain('ipcMain.handle("notifications:show"');
    expect(preload).toContain('ipcRenderer.invoke("notifications:show"');
  });

  it("packages the real TEMPO art for the window, tray, and alerts", () => {
    expect(desktopPackage.build.extraResources).toContainEqual({
      from: "../public/icon-512.png",
      to: "assets/tempo-icon.png",
    });
    expect(main).toContain('path.join(process.resourcesPath, "assets", "tempo-icon.png")');
  });
});
