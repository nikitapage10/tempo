// TEMPO Desktop — Electron main process. See planning/desktop/02 for the
// design this implements: §2 process architecture, §3 the local vault, §7
// tray/background sync.
//
// Deliberately does NOT bundle the Next.js server or any server secret —
// the renderer loads the production origin over HTTPS, exactly like a
// browser tab, and everything that needs a service-role key or other
// secret stays on Vercel. This process only ever authenticates as the
// signed-in artist, same as a browser tab would.

const { app, BrowserWindow, Tray, Menu, nativeImage, shell, ipcMain, protocol, net, dialog, screen } = require("electron");
const path = require("path");
const { pathToFileURL } = require("url");
const { autoUpdater } = require("electron-updater");
const { Vault } = require("./vault");
const { version: appVersion } = require("./package.json");

const APP_URL = process.env.TEMPO_DESKTOP_URL || "https://tempo-ten-sigma.vercel.app";
const ALLOWED_ORIGINS = [new URL(APP_URL).origin];
const SYNC_INTERVAL_MS = 5 * 60 * 1000;
const UPDATE_INTERVAL_MS = 6 * 60 * 60 * 1000;
const VAULT_PROTOCOL = "tempo-local";

// Matches --bg-0 / --text-lo from app/globals.css, so the native window
// chrome (title bar, and on Windows the caption buttons) reads as part of
// TEMPO rather than a generic browser window dropped on top of it.
const CHROME_BG = "#0A0A0C";
const CHROME_SYMBOL = "#8B8B96";
const TITLE_BAR_HEIGHT = 40;

const ZOOM_STEP = 0.1;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.0;

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
let updateTimer = null;
let updateCheckInFlight = false;
let syncEnabled = true; // mirrors the "Keep TEMPO syncing in the background" setting
let vault = null;

// A fixed 1440x900 could easily be a large fraction of a small display or a
// small fraction of a big one — size relative to the actual screen instead,
// generously large but deliberately short of a full maximize (the artist
// asked for "a little bit larger", not filling the screen).
function initialWindowBounds() {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  const width = Math.round(screenWidth * 0.85);
  const height = Math.round(screenHeight * 0.85);
  return {
    width,
    height,
    x: Math.round((screenWidth - width) / 2),
    y: Math.round((screenHeight - height) / 2),
  };
}

function createWindow() {
  const isMac = process.platform === "darwin";

  mainWindow = new BrowserWindow({
    ...initialWindowBounds(),
    // Low enough to pass through the web app's own responsive breakpoint
    // (the rail collapses to a phone-style bottom tab bar under Tailwind's
    // md: ~768px) — a 960 floor meant the window could never actually get
    // narrow enough to reach it, so shrinking the window never visibly did
    // anything to the sidebar. 420 matches the app's real phone-width floor.
    minWidth: 420,
    minHeight: 480,
    backgroundColor: CHROME_BG, // matches --bg-0, avoids a white flash on first paint
    show: false,
    autoHideMenuBar: true,
    // Keeps native min/max/close (Windows) or traffic lights (Mac) — removing
    // the frame entirely would mean building custom replacements in the web
    // app's own React tree, which is more than this chrome pass needs — but
    // re-themes them to match the app instead of stock white Windows buttons.
    ...(isMac
      ? { titleBarStyle: "hiddenInset" }
      : {
          titleBarStyle: "hidden",
          titleBarOverlay: { color: CHROME_BG, symbolColor: CHROME_SYMBOL, height: TITLE_BAR_HEIGHT },
        }),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // See preload.js's own comment — a sandboxed preload can't reliably
      // require("./package.json") by relative path, so the version crosses
      // the boundary as a plain argv flag instead.
      additionalArguments: [`--tempo-app-version=${appVersion}`],
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.loadURL(APP_URL);
  registerZoomShortcuts(mainWindow);

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

// No visible menu bar (autoHideMenuBar above, plus Menu.setApplicationMenu(null)
// below on Windows), so the accelerators that would normally live on a "View"
// menu — zoom in/out/reset — are wired up by hand, shared between the
// keyboard shortcut here and the on-screen control's IPC calls below.
function adjustZoom(win, delta) {
  const current = win.webContents.getZoomFactor();
  const next = delta === 0 ? 1.0 : Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, current + delta));
  win.webContents.setZoomFactor(next);
  return next;
}

function registerZoomShortcuts(win) {
  win.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return;
    const withModifier = process.platform === "darwin" ? input.meta : input.control;
    if (!withModifier) return;

    if (input.key === "=" || input.key === "+") {
      event.preventDefault();
      adjustZoom(win, ZOOM_STEP);
    } else if (input.key === "-") {
      event.preventDefault();
      adjustZoom(win, -ZOOM_STEP);
    } else if (input.key === "0") {
      event.preventDefault();
      adjustZoom(win, 0);
    }
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

// Desktop can remain resident in the tray for days, so checking only at
// process startup leaves long-running installs behind. The updater downloads
// quietly and installs on a full quit; this guard prevents overlapping checks
// if a slow network call is still active when the interval fires again.
async function checkForDesktopUpdate() {
  if (!app.isPackaged || updateCheckInFlight) return;
  updateCheckInFlight = true;
  try {
    await autoUpdater.checkForUpdatesAndNotify();
  } catch (err) {
    console.warn("[tempo-desktop] auto-update check skipped:", err.message);
  } finally {
    updateCheckInFlight = false;
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

  ipcMain.handle("zoom:in", () => adjustZoom(mainWindow, ZOOM_STEP));
  ipcMain.handle("zoom:out", () => adjustZoom(mainWindow, -ZOOM_STEP));
  ipcMain.handle("zoom:reset", () => adjustZoom(mainWindow, 0));
  ipcMain.handle("zoom:get", () => mainWindow.webContents.getZoomFactor());
}

app.whenReady().then(() => {
  vault = new Vault();
  registerVaultProtocol();
  registerVaultIpc();

  // Windows: no menu bar at all — File/Edit/View/Window/Help added nothing
  // (no custom items were ever in it) and just looked like leftover browser
  // chrome. macOS keeps a minimal app menu; removing it there also breaks
  // standard Cmd+C/V/X clipboard shortcuts in text fields, which Electron
  // wires through the Edit menu's roles rather than the OS.
  if (process.platform === "darwin") {
    Menu.setApplicationMenu(
      Menu.buildFromTemplate([
        { role: "appMenu" },
        { role: "editMenu" },
        { role: "windowMenu" },
      ])
    );
  } else {
    Menu.setApplicationMenu(null);
  }

  app.setLoginItemSettings({ openAtLogin: true, openAsHidden: true });

  createWindow();
  createTray();

  syncTimer = setInterval(syncTick, SYNC_INTERVAL_MS);
  void syncTick();

  // electron-updater's default is to download in the background and install
  // on quit. State it explicitly because that is TEMPO's release contract.
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  void checkForDesktopUpdate();
  updateTimer = setInterval(checkForDesktopUpdate, UPDATE_INTERVAL_MS);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else mainWindow?.show();
  });
});

app.on("before-quit", () => {
  quitting = true;
  if (syncTimer) clearInterval(syncTimer);
  if (updateTimer) clearInterval(updateTimer);
});

app.on("window-all-closed", () => {
  // Never quit on window close while sync is on (macOS default + explicit
  // desktop-sync behavior) — only "Quit TEMPO" from the tray exits fully.
  if (process.platform !== "darwin" && !syncEnabled) app.quit();
});
