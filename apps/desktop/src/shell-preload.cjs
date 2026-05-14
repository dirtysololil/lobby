const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("LobbyWindow", {
  close: () => ipcRenderer.invoke("desktop-window:close"),
  getState: () => ipcRenderer.invoke("desktop-window:get-state"),
  minimize: () => ipcRenderer.invoke("desktop-window:minimize"),
  onStateChange: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("desktop-window:state", listener);

    return () => ipcRenderer.removeListener("desktop-window:state", listener);
  },
  toggleMaximize: () => ipcRenderer.invoke("desktop-window:toggle-maximize"),
});
