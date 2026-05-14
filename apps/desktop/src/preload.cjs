const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("LobbyDesktop", {
  getConfig: () => ipcRenderer.invoke("desktop:get-config"),
  reload: () => ipcRenderer.invoke("desktop:reload"),
});
