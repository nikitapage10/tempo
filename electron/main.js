// TEMPO Desktop — Electron main process. See planning/desktop/02 for the
// design this implements: §2 process architecture, §3 the local vault, §7
// tray/background sync.
//
// Deliberately does NOT bundle the Next.js server or any server secret —
// the renderer loads the production origin over HTTPS, exactly like a
// browser tab, and everything that needs a service-role key or other
// secret stays on Vercel. This process only ever authenticates as the
// signed-in artist, same as a browser tab would.

const { app, BrowserWindow, Tray, Menu, nativeImage, shell, ipcMain, protocol, net, dialog } = require("electron");
const path = require("path");
const { pathToFileURL } = require("url");
const { autoUpdater } = require("electron-updater");
const { Vault } = require("./vault");

const APP_URL = process.env.TEMPO_DESKTOP_URL || "https://tempo-ten-sigma.vercel.app";
const ALLOWED_ORIGINS = [new URL(APP_URL).origin];
const SYNC_INTERVAL_MS = 5 * 60 * 1000;
const VAULT_PROTOCOL = "tempo-local";

// Privileged-scheme registration must happen before app.whenReady().
protocol.registerSchemesAsPrivileged([
  {
    scheme: VAULT_PROTOCOL,
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true },
  },
]);

let mainWindow = null;
let tray = null;
let quitting = false;
let syncTimer = null;
let syncEnabled = true; // mirrors the "Keep TEMPO syncing in the background" setting
let vault = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: "#0A0A0C", // matches --bg-0, avoids a white flash on first paint
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.loadURL(APP_URL);

  // Navigation allowlist — the renderer is a real Chromium context and
  // could otherwise be steered anywhere; keep it to the TEMPO origin.
  // OAuth providers and any other external link open in the system browser.
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!ALLOWED_ORIGINS.includes(new URL(url).origin)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  // Closing the window steps back to the tray instead of quitting, as long
  // as background sync is enabled — see planning/desktop/01 "Background sync".
  mainWindow.on("close", (event) => {
    if (quitting || !syncEnabled) return;
    event.preventDefault();
    mainWindow.hide();
  });
}

function trayIcon() {
  // Placeholder monochrome dot until real tray art ships; nativeImage.createEmpty()
  // would render blank on some platforms, so this is a minimal visible fallback.
  return nativeImage.createFromDataURL(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAI0lEQVR4AWNgGAWjgP6AEQjw038MjIhAA5r+YyIB/xj+jwIA8kEO/8YfYtQAAAAASUVORK5CYII="
  );
}

function createTray() {
  tray = new Tray(trayIcon());
  tray.setToolTip("TEMPO");
  refreshTrayMenu("synced");

  tray.on("click", () => {
    if (!mainWindow) return;
    mainWindow.isVisible() ? mainWindow.focus() : mainWindow.show();
  });
}

function refreshTrayMenu(state) {
  if (!tray) return;
  const label = { synced: "Synced", syncing: "Syncing…", offline: "Offline", error: "Sync error" }[state] || "TEMPO";
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: `TEMPO — ${label}`, enabled: false },
      { type: "separator" },
      { label: "Open TEMPO", click: () => mainWindow?.show() },
      {
        label: "Keep syncing in the background",
        type: "checkbox",
        checked: syncEnabled,
        click: (item) => setSyncEnabled(item.checked),
      },
      { type: "separator" },
      { label: "Quit TEMPO", click: () => { quitting = true; app.quit(); } },
    ])
  );
}

function setSyncEnabled(next) {
  syncEnabled = next;
  refreshTrayMenu(syncEnabled ? "synced" : "offline");
}

// A check-in tick: keeps the tray state honest and is the seam the
// catalog/media sync (offline packages) and device last_seen_at refresh
// attach real network work to. Media mirroring itself happens on-demand from
// the renderer via the vault IPC below, not pushed from here yet.
async function syncTick() {
  if (!syncEnabled) return;
  refreshTrayMenu("syncing");
  try {
    vault?.reconcile();
    refreshTrayMenu("synced");
  } catch (err) {
    console.error("[tempo-desktop] sync tick failed", err);
    refreshTrayMenu("error");
  }
}

function registerVaultProtocol() {
  protocol.handle(VAULT_PROTOCOL, (request) => {
    // tempo-local://tracks/{id}/versions/{id}/file.mp3 — host segment of a
    // "standard" custom scheme is the URL's first path component, so the
    // storage path has to be reassembled from host + pathname.
    const url = new URL(request.url);
    const storagePath = decodeURIComponent(`${url.host}${url.pathname}`);
    if (!vault || !vault.has(storagePath)) {
      return new Response("Not found in the local vault.", { status: 404 });
    }
    const absolute = path.join(vault.root, ...storagePath.split("/"));
    return net.fetch(pathToFileURL(absolute).toString());
  });
}

function registerVaultIpc() {
  ipcMain.handle("vault:has", (_e, storagePath) => vault.has(storagePath));
  ipcMain.handle("vault:stat", (_e, storagePath) => vault.stat(storagePath));
  ipcMain.handle("vault:resolveUrl", (_e, storagePath) => {
    if (!vault.has(storagePath)) return null;
    return `${VAULT_PROTOCOL}://${storagePath}`;
  });
  ipcMain.handle("vault:write", async (_e, storagePath, arrayBuffer) => {
    return vault.write(storagePath, Buffer.from(arrayBuffer));
  });
  ipcMain.handle("vault:remove", (_e, storagePath) => vault.remove(storagePath));
  ipcMain.handle("vault:stats", () => vault.stats());
  ipcMain.handle("vault:relocate", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openDirectory", "createDirectory"],
      title: "Choose a folder for your TEMPO vault",
    });
    if (result.canceled || !result.filePaths[0]) return { ok: false, cancelled: true };
    return vault.relocate(result.filePaths[0]);
  });
  ipcMain.handle("sync:setEnabled", (_e, next) => setSyncEnabled(Boolean(next)));
  ipcMain.handle("sync:getEnabled", () => syncEnabled);
}

app.whenReady().then(() => {
  vault = new Vault();
  registerVaultProtocol();
  registerVaultIpc();

  app.setLoginItemSettings({ openAtLogin: true, openAsHidden: true });

  createWindow();
  createTray();

  syncTimer = setInterval(syncTick, SYNC_INTERVAL_MS);
  void syncTick();

  autoUpdater.checkForUpdatesAndNotify().catch((err) => {
    // Fails harmlessly pre-release (no publish target configured yet).
    console.warn("[tempo-desktop] auto-update check skipped:", err.message);
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else mainWindow?.show();
  });
});

app.on("before-quit", () => {
  quitting = true;
  if (syncTimer) clearInterval(syncTimer);
});

app.on("window-all-closed", () => {
  // Never quit on window close while sync is on (macOS default + explicit
  // desktop-sync behavior) — only "Quit TEMPO" from the tray exits fully.
  if (process.platform !== "darwin" && !syncEnabled) app.quit();
});
