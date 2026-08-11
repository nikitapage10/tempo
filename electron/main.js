// TEMPO Desktop — Electron main process. See planning/desktop/02 for the
// design this implements: §2 process architecture, §3 the local vault, §7
// tray/background sync.
//
// Deliberately does NOT bundle the Next.js server or any server secret —
// the renderer loads the production origin over HTTPS, exactly like a
// browser tab, and everything that needs a service-role key or other
// secret stays on Vercel. This process only ever authenticates as the
// signed-in artist, same as a browser tab would.

const { app, BrowserWindow, Tray, Menu, nativeImage, shell, ipcMain, protocol, net, dialog, screen, session, systemPreferences } = require("electron");
const path = require("path");
const { pathToFileURL } = require("url");
const { autoUpdater } = require("electron-updater");
const { Vault } = require("./vault");
const { isMediaRequestAllowed } = require("./media-permissions");
const { version: appVersion } = require("./package.json");

const APP_URL = process.env.TEMPO_DESKTOP_URL || "https://tempo-ten-sigma.vercel.app";
const ALLOWED_ORIGINS = [new URL(APP_URL).origin];
const SYNC_INTERVAL_MS = 5 * 60 * 1000;
const UPDATE_INTERVAL_MS = 6 * 60 * 60 * 1000;
const VAULT_PROTOCOL = "tempo-local";
const APP_PROTOCOL = "tempo";
const APP_USER_MODEL_ID = "com.tempo.desktop";

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
let desktopUpdateReady = false;
let syncEnabled = true; // mirrors the "Keep TEMPO syncing in the background" setting
let vault = null;
let pendingAppLink = null;
let notificationWindow = null;
let notificationTimer = null;

// Give Windows notifications and taskbar entries a stable TEMPO identity.
if (process.platform === "win32") app.setAppUserModelId(APP_USER_MODEL_ID);
// The desktop shell is explicitly allowed to make its two quiet alert tones
// while hidden; ordinary web browsers still keep their normal gesture policy.
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) app.quit();

// Register tempo:// links with the operating system. The explicit executable
// and entrypoint are needed while running Electron directly in development;
// packaged builds register the app executable itself.
if (hasSingleInstanceLock) {
  if (process.defaultApp && process.argv[1]) {
    app.setAsDefaultProtocolClient(APP_PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
  } else {
    app.setAsDefaultProtocolClient(APP_PROTOCOL);
  }
}

function appLinkFromArgs(args) {
  return args.find((arg) => typeof arg === "string" && arg.toLowerCase().startsWith(`${APP_PROTOCOL}://`)) || null;
}

function appLinkDestination(rawUrl) {
  if (!rawUrl) return null;
  try {
    const link = new URL(rawUrl);
    if (link.protocol !== `${APP_PROTOCOL}:` || link.hostname !== "open") return null;
    const requestedPath = link.searchParams.get("path") || "/";
    if (!requestedPath.startsWith("/") || requestedPath.startsWith("//")) return null;
    const destination = new URL(requestedPath, APP_URL);
    return ALLOWED_ORIGINS.includes(destination.origin) ? destination.href : null;
  } catch {
    return null;
  }
}

function receiveAppLink(rawUrl) {
  const destination = appLinkDestination(rawUrl);
  if (!destination) return false;
  if (!app.isReady() || !mainWindow) {
    pendingAppLink = rawUrl;
    return true;
  }
  mainWindow.loadURL(destination);
  showMainWindow();
  return true;
}

pendingAppLink = appLinkFromArgs(process.argv);

// macOS delivers custom-protocol launches through open-url rather than argv.
app.on("open-url", (event, url) => {
  event.preventDefault();
  receiveAppLink(url);
});

function appIconPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "assets", "tempo-icon.png")
    : path.join(__dirname, "..", "public", "tempo-emblem.png");
}

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
    icon: appIconPath(),
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
      // Keep Supabase realtime delivery active while the window lives in the tray.
      backgroundThrottling: false,
      // See preload.js's own comment — a sandboxed preload can't reliably
      // require("./package.json") by relative path, so the version crosses
      // the boundary as a plain argv flag instead.
      additionalArguments: [`--tempo-app-version=${appVersion}`],
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());
  const initialUrl = appLinkDestination(pendingAppLink) || APP_URL;
  pendingAppLink = null;
  mainWindow.loadURL(initialUrl);
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

  // Closing the window always steps back to the tray instead of quitting.
  mainWindow.on("close", (event) => {
    if (quitting) return;
    event.preventDefault();
    mainWindow.hide();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function mediaRequestAllowed(webContents, permission, details = {}) {
  const requestingUrl = details.requestingUrl || details.securityOrigin || webContents?.getURL?.() || "";
  return isMediaRequestAllowed({
    allowedOrigins: ALLOWED_ORIGINS,
    requestUrl: requestingUrl,
    permission,
    mediaTypes: details.mediaTypes,
    mediaType: details.mediaType,
  });
}

function registerMediaPermissions() {
  session.defaultSession.setPermissionCheckHandler((webContents, permission, _origin, details) =>
    mediaRequestAllowed(webContents, permission, details)
  );
  session.defaultSession.setPermissionRequestHandler(async (webContents, permission, callback, details) => {
    if (!mediaRequestAllowed(webContents, permission, details)) {
      callback(false);
      return;
    }
    if (process.platform === "darwin") {
      try {
        callback(await systemPreferences.askForMediaAccess("microphone"));
      } catch {
        callback(false);
      }
      return;
    }
    callback(true);
  });
}

function showMainWindow() {
  if (!mainWindow) {
    createWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
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
  const image = nativeImage.createFromPath(appIconPath());
  if (!image.isEmpty()) {
    const { width, height } = image.getSize();
    const side = Math.max(1, Math.floor(Math.min(width, height) * 0.72));
    const cropped = image.crop({
      x: Math.floor((width - side) / 2),
      y: Math.floor((height - side) / 2),
      width: side,
      height: side,
    });
    return cropped.resize({ width: 32, height: 32, quality: "best" });
  }

  // Visible last resort if an unpackaged development tree is incomplete.
  return nativeImage.createFromDataURL(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAJElEQVR4Ae3BAQ0AAADCoPdPbQ43oAAAAAAAAAAAAAAAAAAAAIC3AEEgAAHuoUelAAAAAElFTkSuQmCC"
  );
}

function createTray() {
  tray = new Tray(trayIcon());
  tray.setToolTip("TEMPO");
  refreshTrayMenu("synced");

  tray.on("click", () => {
    showMainWindow();
  });
}

function refreshTrayMenu(state) {
  if (!tray) return;
  const label = { synced: "Synced", syncing: "Syncing…", offline: "Offline", error: "Sync error" }[state] || "TEMPO";
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: `TEMPO — ${label}`, enabled: false },
      { type: "separator" },
      { label: "Open TEMPO", click: showMainWindow },
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

function allowedDeepLink(url) {
  if (typeof url !== "string" || !url.trim()) return null;
  try {
    const resolved = new URL(url, APP_URL);
    return ALLOWED_ORIGINS.includes(resolved.origin) ? resolved.toString() : null;
  } catch {
    return null;
  }
}

function notificationMarkup({ kind, title, body }) {
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);
  const label = kind === "message" ? "NEW MESSAGE" : "TEMPO NOTIFICATION";
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
*{box-sizing:border-box}html,body{width:100%;height:100%;margin:0;background:transparent;font-family:Inter,"Segoe UI",sans-serif;color:#f7f7fa}
a{display:block;width:100%;height:100%;padding:8px;text-decoration:none;color:inherit}
.toast{position:relative;width:100%;height:100%;overflow:hidden;border:1px solid rgba(255,255,255,.17);border-radius:20px;background:linear-gradient(135deg,rgba(22,24,32,.91),rgba(10,11,17,.82));box-shadow:0 18px 50px rgba(0,0,0,.46),inset 0 1px 0 rgba(255,255,255,.1);backdrop-filter:blur(28px) saturate(145%);-webkit-backdrop-filter:blur(28px) saturate(145%)}
.glow{position:absolute;inset:-45% 48% 30% -20%;background:radial-gradient(circle,rgba(70,193,255,.25),transparent 68%);pointer-events:none}
.content{position:relative;display:grid;grid-template-columns:48px 1fr;gap:13px;align-items:center;height:100%;padding:15px 18px}
.mark{display:flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:15px;background:rgba(255,255,255,.07);box-shadow:inset 0 0 0 1px rgba(255,255,255,.08)}
.bars{display:flex;align-items:center;gap:3px;height:28px}.bars i{display:block;width:4px;border-radius:99px;background:linear-gradient(#5ed7ff 0 45%,#fff 57%,#ffb338);box-shadow:0 0 8px rgba(85,201,255,.45)}.bars i:nth-child(1),.bars i:nth-child(5){height:12px}.bars i:nth-child(2),.bars i:nth-child(4){height:21px}.bars i:nth-child(3){height:28px}
.label{margin-bottom:4px;color:#8fcbf3;font-size:10px;font-weight:700;letter-spacing:.14em}.title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;font-weight:650;line-height:1.25}.body{display:-webkit-box;overflow:hidden;margin-top:4px;color:rgba(235,237,244,.68);font-size:12px;line-height:1.35;-webkit-box-orient:vertical;-webkit-line-clamp:2}
</style></head><body><a href="tempo-notification://open"><div class="toast"><div class="glow"></div><div class="content"><div class="mark"><div class="bars"><i></i><i></i><i></i><i></i><i></i></div></div><div><div class="label">${label}</div><div class="title">${escapeHtml(title)}</div>${body ? `<div class="body">${escapeHtml(body)}</div>` : ""}</div></div></div></a></body></html>`;
}

function closeNotificationWindow() {
  if (notificationTimer) clearTimeout(notificationTimer);
  notificationTimer = null;
  if (notificationWindow && !notificationWindow.isDestroyed()) notificationWindow.destroy();
  notificationWindow = null;
}

function showGlassNotification(input) {
  if (mainWindow?.isFocused()) return false;
  const kind = input?.kind === "message" ? "message" : "notification";
  const title = String(input?.title || (kind === "message" ? "New message" : "New notification"))
    .trim()
    .slice(0, 120);
  const body = typeof input?.body === "string" ? input.body.trim().slice(0, 280) : "";
  const destination = allowedDeepLink(input?.url);
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const width = 380;
  const height = 112;
  const margin = 18;

  closeNotificationWindow();
  notificationWindow = new BrowserWindow({
    width,
    height,
    x: display.workArea.x + display.workArea.width - width - margin,
    y: display.workArea.y + display.workArea.height - height - margin,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    hasShadow: false,
    backgroundColor: "#00000000",
    ...(process.platform === "win32" ? { backgroundMaterial: "acrylic" } : {}),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const popup = notificationWindow;
  popup.webContents.on("will-navigate", (event, url) => {
    if (url !== "tempo-notification://open") return;
    event.preventDefault();
    closeNotificationWindow();
    showMainWindow();
    if (destination) mainWindow?.webContents.send("notifications:open", destination);
  });
  popup.once("ready-to-show", () => popup.showInactive());
  popup.once("closed", () => {
    if (notificationWindow === popup) notificationWindow = null;
  });
  popup.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(notificationMarkup({ kind, title, body }))}`);
  notificationTimer = setTimeout(closeNotificationWindow, 7000);
  return true;
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
    // Download silently. TEMPO's in-app banner is the only update prompt.
    await autoUpdater.checkForUpdates();
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
  ipcMain.handle("notifications:show", (_e, input) => showGlassNotification(input));
}

function desktopUpdateState() {
  return { ready: desktopUpdateReady };
}

function broadcastDesktopUpdateState() {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send("updates:state", desktopUpdateState());
  }
}

function registerUpdateIpc() {
  autoUpdater.on("update-downloaded", () => {
    desktopUpdateReady = true;
    broadcastDesktopUpdateState();
  });

  ipcMain.handle("updates:getState", () => desktopUpdateState());
  ipcMain.handle("updates:install", () => {
    if (!desktopUpdateReady) return false;

    // Let the IPC response cross the bridge before Electron closes and hands
    // control to the downloaded installer.
    setImmediate(() => {
      quitting = true;
      autoUpdater.quitAndInstall(false, true);
    });
    return true;
  });
}

app.whenReady().then(() => {
  if (!hasSingleInstanceLock) return;
  vault = new Vault();
  registerVaultProtocol();
  registerVaultIpc();
  registerUpdateIpc();
  registerMediaPermissions();

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
    showMainWindow();
  });
});

app.on("second-instance", (_event, argv) => {
  const appLink = appLinkFromArgs(argv);
  if (!receiveAppLink(appLink) && app.isReady()) showMainWindow();
});

app.on("before-quit", () => {
  quitting = true;
  closeNotificationWindow();
  if (syncTimer) clearInterval(syncTimer);
  if (updateTimer) clearInterval(updateTimer);
});

app.on("window-all-closed", () => {
  // Closing the visible window hides it rather than reaching this event. If
  // a renderer is destroyed unexpectedly, leave the tray process resident.
});
