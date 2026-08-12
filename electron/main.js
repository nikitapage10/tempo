// TEMPO Desktop — Electron main process. See planning/desktop/02 for the
// design this implements: §2 process architecture, §3 the local vault, §7
// tray/background sync.
//
// Deliberately does NOT bundle the Next.js server or any server secret —
// the renderer loads the production origin over HTTPS, exactly like a
// browser tab, and everything that needs a service-role key or other
// secret stays on Vercel. This process only ever authenticates as the
// signed-in artist, same as a browser tab would.

const { app, BrowserWindow, Tray, Menu, nativeImage, shell, ipcMain, protocol, dialog, screen, session, systemPreferences } = require("electron");
const path = require("path");
const { autoUpdater } = require("electron-updater");
const { Vault } = require("./vault");
const { createVaultMediaResponse } = require("./vault-media-response");
const { isMediaRequestAllowed } = require("./media-permissions");
const { isAllowedDesktopNavigation } = require("./oauth-navigation");
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
// Keep Supabase realtime + alert timers alive while TEMPO lives in the tray.
app.commandLine.appendSwitch("disable-renderer-backgrounding");
app.commandLine.appendSwitch("disable-background-timer-throttling");

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  // Quit alone is async on Windows — a second Start-menu launch can still
  // spin up a tray icon / window before the process dies. Exit hard.
  app.quit();
  process.exit(0);
}

// Register tempo:// links with the operating system. The explicit executable
// and entrypoint are needed while running Electron directly in development;
// packaged builds register the app executable itself.
if (process.defaultApp && process.argv[1]) {
  app.setAsDefaultProtocolClient(APP_PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
} else {
  app.setAsDefaultProtocolClient(APP_PROTOCOL);
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

// Embedded 32×32 emblem — last resort when packaged assets are missing so the
// tray never falls back to a transparent pixel (blank Start/tray slot).
const TRAY_FALLBACK_PNG =
  "data:image/png;base64,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";

function packagedAsset(...parts) {
  return path.join(process.resourcesPath, "assets", ...parts);
}

function devAsset(...parts) {
  return path.join(__dirname, "..", "public", ...parts);
}

/** Window / Start-menu / taskbar identity — prefer multi-size .ico on Windows. */
function appIconPath() {
  if (process.platform === "win32") {
    return app.isPackaged ? packagedAsset("tempo-icon.ico") : devAsset("tempo-icon.ico");
  }
  return app.isPackaged ? packagedAsset("tempo-icon.png") : devAsset("tempo-emblem.png");
}

/** Tray wants small bitmaps; oversized source PNGs often read as blank on Win11. */
function trayIconCandidates() {
  if (app.isPackaged) {
    return [packagedAsset("tempo-tray-32.png"), packagedAsset("tempo-tray-16.png"), packagedAsset("tempo-icon.ico")];
  }
  return [devAsset("tempo-tray-32.png"), devAsset("tempo-tray-16.png"), devAsset("tempo-icon.ico"), devAsset("tempo-emblem.png")];
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
  guardRendererNavigation(mainWindow.webContents);

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

/**
 * Keep TEMPO + OAuth provider navigations inside Electron so the session
 * cookies are written in this app. Everything else still opens externally.
 */
function guardRendererNavigation(webContents) {
  if (!webContents || webContents.__tempoNavGuarded) return;
  webContents.__tempoNavGuarded = true;

  webContents.on("will-navigate", (event, url) => {
    if (isAllowedDesktopNavigation(url, ALLOWED_ORIGINS)) return;
    event.preventDefault();
    shell.openExternal(url);
  });

  webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedDesktopNavigation(url, ALLOWED_ORIGINS)) {
      return { action: "allow" };
    }
    shell.openExternal(url);
    return { action: "deny" };
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
  for (const candidate of trayIconCandidates()) {
    const image = nativeImage.createFromPath(candidate);
    if (image.isEmpty()) continue;
    const { width, height } = image.getSize();
    // Already tray-sized — use as-is (avoids muddy downscales of 16→32).
    if (width <= 32 && height <= 32) return image;
    return image.resize({ width: 32, height: 32, quality: "best" });
  }
  return nativeImage.createFromDataURL(TRAY_FALLBACK_PNG);
}

function createTray() {
  tray = new Tray(trayIcon());
  tray.setImage(trayIcon());
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

function notificationMarkup({ kind, title, body, ice, amber }) {
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);
  const label = kind === "message" ? "NEW MESSAGE" : "TEMPO NOTIFICATION";
  const iceHex = typeof ice === "string" && /^#[0-9A-Fa-f]{6}$/.test(ice) ? ice : "#7FB4FF";
  const amberHex = typeof amber === "string" && /^#[0-9A-Fa-f]{6}$/.test(amber) ? amber : "#FFB56B";
  // Chime runs inside the toast window so it still plays when the main
  // renderer is suspended in the tray.
  const chimeScript = kind === "message"
    ? "[[0,659.25,0.16,0.04],[0.09,880,0.24,0.032]]"
    : "[[0,523.25,0.18,0.032],[0.12,698.46,0.2,0.026]]";
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
*{box-sizing:border-box}html,body{width:100%;height:100%;margin:0;background:transparent;overflow:hidden;font-family:"Segoe UI Variable","Segoe UI",system-ui,sans-serif;color:#f2f0eb}
a{display:block;width:100%;height:100%;padding:0;text-decoration:none;color:inherit}
.toast{position:relative;width:100%;height:100%;overflow:hidden;border:1px solid rgba(38,38,46,.95);border-radius:16px;background:linear-gradient(145deg,rgba(18,18,22,.92),rgba(10,10,12,.88));box-shadow:0 14px 40px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.1);backdrop-filter:blur(22px) saturate(1.15);-webkit-backdrop-filter:blur(22px) saturate(1.15)}
.edge{position:absolute;left:0;top:14px;bottom:14px;width:2px;border-radius:2px;background:linear-gradient(to bottom,transparent,${amberHex},${iceHex},transparent);box-shadow:0 0 16px ${iceHex}99}
.glow{position:absolute;inset:-35% 40% 20% -30%;background:radial-gradient(circle,${iceHex}33,transparent 70%);pointer-events:none}
.hi{position:absolute;inset:0 0 auto 0;height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.12),transparent);pointer-events:none}
.content{position:relative;display:grid;grid-template-columns:56px 1fr;gap:16px;align-items:center;height:100%;padding:20px 22px 20px 24px}
.mark{display:flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:14px;background:rgba(26,26,33,.85);box-shadow:inset 0 0 0 1px rgba(38,38,46,.95)}
.bars{display:flex;align-items:center;gap:3px;height:30px}.bars i{display:block;width:4px;border-radius:99px;background:linear-gradient(${iceHex} 0 45%,#fff 57%,${amberHex});box-shadow:0 0 10px ${iceHex}73}.bars i:nth-child(1),.bars i:nth-child(5){height:12px}.bars i:nth-child(2),.bars i:nth-child(4){height:22px}.bars i:nth-child(3){height:30px}
.label{margin-bottom:5px;color:${iceHex};font-size:11px;font-weight:700;letter-spacing:.14em}.title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:16px;font-weight:650;line-height:1.3;color:#f2f0eb}.body{display:-webkit-box;overflow:hidden;margin-top:6px;color:#8b8b96;font-size:13px;line-height:1.45;-webkit-box-orient:vertical;-webkit-line-clamp:2}
</style></head><body><a href="tempo-notification://open"><div class="toast"><div class="edge"></div><div class="glow"></div><div class="hi"></div><div class="content"><div class="mark"><div class="bars"><i></i><i></i><i></i><i></i><i></i></div></div><div><div class="label">${label}</div><div class="title">${escapeHtml(title)}</div>${body ? `<div class="body">${escapeHtml(body)}</div>` : ""}</div></div></div></a><script>
(function(){try{var Ctx=window.AudioContext||window.webkitAudioContext;if(!Ctx)return;var c=new Ctx();var tones=${chimeScript};var start=c.currentTime+0.02;tones.forEach(function(t){var o=c.createOscillator(),g=c.createGain(),a=start+t[0],b=a+t[2];o.type="sine";o.frequency.setValueAtTime(t[1],a);g.gain.setValueAtTime(0.0001,a);g.gain.exponentialRampToValueAtTime(t[3],a+0.02);g.gain.exponentialRampToValueAtTime(0.0001,b);o.connect(g);g.connect(c.destination);o.start(a);o.stop(b+0.02);});}catch(e){}})();
</script></body></html>`;
}

function closeNotificationWindow() {
  if (notificationTimer) clearTimeout(notificationTimer);
  notificationTimer = null;
  if (notificationWindow && !notificationWindow.isDestroyed()) notificationWindow.destroy();
  notificationWindow = null;
}

/** Show when TEMPO isn't the focused foreground window (tray, minimized, or behind). */
function shouldShowDesktopAlert() {
  if (!mainWindow || mainWindow.isDestroyed()) return true;
  if (!mainWindow.isVisible()) return true;
  if (mainWindow.isMinimized()) return true;
  return !mainWindow.isFocused();
}

function showGlassNotification(input) {
  if (!shouldShowDesktopAlert()) return false;
  const kind = input?.kind === "message" ? "message" : "notification";
  const title = String(input?.title || (kind === "message" ? "New message" : "New notification"))
    .trim()
    .slice(0, 120);
  const body = typeof input?.body === "string" ? input.body.trim().slice(0, 280) : "";
  const destination = allowedDeepLink(input?.url);
  const display = screen.getPrimaryDisplay();
  const width = 460;
  const height = 148;
  const margin = 20;
  const work = display.workArea;

  closeNotificationWindow();
  notificationWindow = new BrowserWindow({
    width,
    height,
    x: Math.round(work.x + work.width - width - margin),
    y: Math.round(work.y + work.height - height - margin),
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    show: false,
    hasShadow: true,
    thickFrame: false,
    backgroundColor: "#00000000",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });

  const popup = notificationWindow;
  // screen-saver level beats most always-on-top peers on Windows 11.
  popup.setAlwaysOnTop(true, "screen-saver");
  if (process.platform === "win32") {
    popup.setVisibleOnAllWorkspaces(true);
  }

  popup.webContents.on("will-navigate", (event, url) => {
    if (url !== "tempo-notification://open") return;
    event.preventDefault();
    closeNotificationWindow();
    showMainWindow();
    if (destination) mainWindow?.webContents.send("notifications:open", destination);
  });
  popup.once("ready-to-show", () => {
    // show() — not showInactive — so Win11 actually composites the transparent
    // toast. focusable:false keeps TEMPO from stealing keyboard focus.
    popup.show();
  });
  popup.once("closed", () => {
    if (notificationWindow === popup) notificationWindow = null;
  });
  popup.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(
      notificationMarkup({
        kind,
        title,
        body,
        ice: input?.ice,
        amber: input?.amber,
      })
    )}`
  );
  notificationTimer = setTimeout(closeNotificationWindow, 8000);
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
    // Must honor Range (206) so Chromium can seek <audio>/<video> — bare
    // net.fetch(file://) leaves seekable empty and scrub-then-play resets to 0.
    const url = new URL(request.url);
    const storagePath = decodeURIComponent(`${url.host}${url.pathname}`);
    if (!vault || !vault.has(storagePath)) {
      return new Response("Not found in the local vault.", { status: 404 });
    }
    const absolute = path.join(vault.root, ...storagePath.split("/"));
    return createVaultMediaResponse(absolute, request);
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

  // OAuth popups (and any future in-app windows) get the same navigation
  // allowlist as the main window.
  app.on("web-contents-created", (_event, contents) => {
    guardRendererNavigation(contents);
  });

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
