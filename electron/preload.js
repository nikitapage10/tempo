// Narrow, explicitly-typed bridge — contextIsolation is on, nodeIntegration
// is off, so this is the only surface the renderer (the ordinary TEMPO web
// app) gets into the native shell. Every call crosses into the main process
// via ipcRenderer.invoke; nothing here touches the filesystem directly.
const { contextBridge, ipcRenderer } = require("electron");
const { version: appVersion } = require("./package.json");

contextBridge.exposeInMainWorld("tempoDesktop", {
  isDesktop: true,
  platform: process.platform === "darwin" ? "mac" : "windows",
  appVersion,

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
});
