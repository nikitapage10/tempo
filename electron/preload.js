// Narrow, explicitly-typed bridge — contextIsolation is on, nodeIntegration
// is off, so this is the only surface the renderer (the ordinary TEMPO web
// app) gets into the native shell. Every call crosses into the main process
// via ipcRenderer.invoke; nothing here touches the filesystem directly.
//
// Deliberately avoids `require("./package.json")` — a sandboxed preload
// script (webPreferences.sandbox: true, the default since Electron 20 and
// what main.js sets explicitly) can't reliably resolve a relative require
// to a local file the way an ordinary Node module can. That failure is
// silent — it doesn't crash the window, it just means this whole script
// throws before contextBridge.exposeInMainWorld ever runs, so the renderer
// never sees window.tempoDesktop and can't tell it's running inside the
// desktop app at all. main.js instead passes the version in as a plain
// process.argv flag, which sandboxed preload can always read.
const { contextBridge, ipcRenderer } = require("electron");

function readAppVersion() {
  const flag = process.argv.find((arg) => arg.startsWith("--tempo-app-version="));
  return flag ? flag.slice("--tempo-app-version=".length) : "0.0.0";
}

contextBridge.exposeInMainWorld("tempoDesktop", {
  isDesktop: true,
  platform: process.platform === "darwin" ? "mac" : "windows",
  appVersion: readAppVersion(),

  vault: {
    has: (storagePath) => ipcRenderer.invoke("vault:has", storagePath),
    stat: (storagePath) => ipcRenderer.invoke("vault:stat", storagePath),
    resolveUrl: (storagePath) => ipcRenderer.invoke("vault:resolveUrl", storagePath),
    write: (storagePath, arrayBuffer) => ipcRenderer.invoke("vault:write", storagePath, arrayBuffer),
    remove: (storagePath) => ipcRenderer.invoke("vault:remove", storagePath),
    stats: () => ipcRenderer.invoke("vault:stats"),
    relocate: () => ipcRenderer.invoke("vault:relocate"),
  },

  sync: {
    setEnabled: (next) => ipcRenderer.invoke("sync:setEnabled", next),
    getEnabled: () => ipcRenderer.invoke("sync:getEnabled"),
  },

  openExternal: (url) => ipcRenderer.invoke("shell:openExternal", url),

  zoom: {
    in: () => ipcRenderer.invoke("zoom:in"),
    out: () => ipcRenderer.invoke("zoom:out"),
    reset: () => ipcRenderer.invoke("zoom:reset"),
    get: () => ipcRenderer.invoke("zoom:get"),
    resetNative: () => ipcRenderer.invoke("zoom:resetNative"),
    onNudge: (callback) => {
      const listener = (_event, delta) => callback(delta);
      ipcRenderer.on("zoom:nudge", listener);
      return () => ipcRenderer.removeListener("zoom:nudge", listener);
    },
  },

  updates: {
    getState: () => ipcRenderer.invoke("updates:getState"),
    install: () => ipcRenderer.invoke("updates:install"),
    onStateChange: (callback) => {
      const listener = (_event, state) => callback(state);
      ipcRenderer.on("updates:state", listener);
      return () => ipcRenderer.removeListener("updates:state", listener);
    },
  },

  dictation: {
    start: (clientSecret) => ipcRenderer.invoke("dictation:start", clientSecret),
    send: (payload) => ipcRenderer.send("dictation:send", payload),
    stop: () => ipcRenderer.invoke("dictation:stop"),
    onEvent: (callback) => {
      const listener = (_event, text) => callback(text);
      ipcRenderer.on("dictation:event", listener);
      return () => ipcRenderer.removeListener("dictation:event", listener);
    },
    onClose: (callback) => {
      const listener = () => callback();
      ipcRenderer.on("dictation:closed", listener);
      return () => ipcRenderer.removeListener("dictation:closed", listener);
    },
  },

  notifications: {
    show: (input) => ipcRenderer.invoke("notifications:show", input),
    onOpen: (callback) => {
      const listener = (_event, url) => callback(url);
      ipcRenderer.on("notifications:open", listener);
      return () => ipcRenderer.removeListener("notifications:open", listener);
    },
  },

  onScreenSourceRequest: (callback) => {
    const listener = (_event, sources) => callback(sources);
    ipcRenderer.on("desktop:screen-sources", listener);
    return () => ipcRenderer.removeListener("desktop:screen-sources", listener);
  },
  chooseScreenSource: (id) => ipcRenderer.invoke("desktop:chooseScreenSource", id),
});
