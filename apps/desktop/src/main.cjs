const {
  app,
  BrowserView,
  BrowserWindow,
  Menu,
  ipcMain,
  shell,
  session,
} = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const generatedConfig = require("./generated-config.cjs");

const titleBarHeight = 38;
const defaultConfig = generatedConfig;

const allowedPermissions = new Set([
  "camera",
  "display-capture",
  "fullscreen",
  "media",
  "microphone",
  "notifications",
]);

let mainWindow;
let appView;
let desktopConfig;

function readJsonFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return {};
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    console.warn(`[desktop] failed to read config ${filePath}: ${error.message}`);
    return {};
  }
}

function resolveConfigPath() {
  if (process.env.LOBBY_DESKTOP_CONFIG) {
    return process.env.LOBBY_DESKTOP_CONFIG;
  }

  const packagedExecutableDir =
    process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(process.execPath);
  const externalConfigPath = app.isPackaged
    ? path.join(packagedExecutableDir, "desktop.config.json")
    : path.join(__dirname, "..", "desktop.config.json");

  return fs.existsSync(externalConfigPath) ? externalConfigPath : "";
}

function normalizeOrigin(value) {
  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}

function normalizeUrl(value, fallback) {
  try {
    const url = new URL(value || fallback);

    if (
      url.protocol !== "https:" &&
      !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))
    ) {
      return new URL(fallback);
    }

    return url;
  } catch {
    return new URL(fallback);
  }
}

function loadDesktopConfig() {
  const fileConfig = readJsonFile(resolveConfigPath());
  const appUrl = normalizeUrl(
    process.env.LOBBY_DESKTOP_URL || fileConfig.appUrl,
    defaultConfig.appUrl,
  );

  const configuredOrigins = Array.isArray(fileConfig.allowedOrigins)
    ? fileConfig.allowedOrigins
    : [];
  const envOrigins = (process.env.LOBBY_DESKTOP_ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  const allowedOrigins = new Set([
    appUrl.origin,
    ...defaultConfig.allowedOrigins.map(normalizeOrigin),
    ...configuredOrigins.map(normalizeOrigin),
    ...envOrigins.map(normalizeOrigin),
  ]);

  allowedOrigins.delete("");

  return {
    appUrl,
    allowedOrigins,
  };
}

function isAllowedAppUrl(value) {
  const origin = normalizeOrigin(value);
  return origin ? desktopConfig.allowedOrigins.has(origin) : false;
}

function isSafeExternalUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:", "mailto:"].includes(url.protocol);
  } catch {
    return false;
  }
}

function openExternalUrl(value) {
  if (isSafeExternalUrl(value)) {
    shell.openExternal(value);
  }
}

function resolveIconPath() {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, "icons", "512x512.png")
    : path.resolve(__dirname, "..", "..", "..", "icons", "512x512.png");

  return fs.existsSync(iconPath) ? iconPath : undefined;
}

function resizeAppView() {
  if (!mainWindow || !appView) {
    return;
  }

  const [width, height] = mainWindow.getContentSize();
  appView.setBounds({
    x: 0,
    y: titleBarHeight,
    width,
    height: Math.max(0, height - titleBarHeight),
  });
}

function sendWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send("desktop-window:state", getWindowState());
}

function getWindowState() {
  if (!mainWindow) {
    return {
      isFullScreen: false,
      isMaximized: false,
    };
  }

  return {
    isFullScreen: mainWindow.isFullScreen(),
    isMaximized: mainWindow.isMaximized(),
  };
}

function attachAppViewHandlers() {
  appView.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedAppUrl(url)) {
      appView.webContents.loadURL(url);
      return { action: "deny" };
    }

    openExternalUrl(url);
    return { action: "deny" };
  });

  appView.webContents.on("will-navigate", (event, url) => {
    if (isAllowedAppUrl(url)) {
      return;
    }

    event.preventDefault();
    openExternalUrl(url);
  });

  appView.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, validatedUrl, isMainFrame) => {
      if (!isMainFrame || errorCode === -3) {
        return;
      }

      appView.webContents.loadFile(path.join(__dirname, "error.html"), {
        query: {
          code: String(errorCode),
          description: errorDescription,
          url: validatedUrl || desktopConfig.appUrl.toString(),
        },
      });
    },
  );
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#000000",
    title: "Lobby",
    icon: resolveIconPath(),
    frame: false,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, "shell-preload.cjs"),
    },
  });

  appView = new BrowserView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  mainWindow.setBrowserView(appView);
  resizeAppView();
  appView.setAutoResize({ width: true, height: true });
  attachAppViewHandlers();

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.on("resize", resizeAppView);
  mainWindow.on("maximize", sendWindowState);
  mainWindow.on("unmaximize", sendWindowState);
  mainWindow.on("enter-full-screen", sendWindowState);
  mainWindow.on("leave-full-screen", sendWindowState);

  mainWindow.loadFile(path.join(__dirname, "shell.html"));
  appView.webContents.loadURL(desktopConfig.appUrl.toString());
}

function registerPermissions() {
  const defaultSession = session.defaultSession;

  defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const requestingUrl = details.requestingUrl || webContents.getURL();
    callback(allowedPermissions.has(permission) && isAllowedAppUrl(requestingUrl));
  });

  defaultSession.setDevicePermissionHandler((details) => {
    return isAllowedAppUrl(details.origin);
  });
}

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) {
      return;
    }

    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }

    mainWindow.focus();
  });

  app.whenReady().then(() => {
    desktopConfig = loadDesktopConfig();
    Menu.setApplicationMenu(null);
    registerPermissions();
    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });
}

ipcMain.handle("desktop:reload", () => {
  if (!appView) {
    return;
  }

  appView.webContents.loadURL(desktopConfig.appUrl.toString());
});

ipcMain.handle("desktop:get-config", () => {
  return {
    appUrl: desktopConfig.appUrl.toString(),
  };
});

ipcMain.handle("desktop-window:minimize", () => {
  mainWindow?.minimize();
});

ipcMain.handle("desktop-window:toggle-maximize", () => {
  if (!mainWindow) {
    return;
  }

  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }

  sendWindowState();
});

ipcMain.handle("desktop-window:close", () => {
  mainWindow?.close();
});

ipcMain.handle("desktop-window:get-state", () => {
  return getWindowState();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
