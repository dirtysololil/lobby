type MobileShellCapacitorConfig = {
  appId: string;
  appName: string;
  webDir: string;
  server: {
    url: string;
    cleartext: boolean;
    androidScheme: "http" | "https";
    allowNavigation: string[];
  };
  android: {
    allowMixedContent: boolean;
  };
  plugins: {
    App: {
      disableBackButtonHandler: boolean;
    };
    Keyboard: {
      resize: "native" | "body" | "ionic" | "none";
      style: "DARK" | "LIGHT";
      resizeOnFullScreen: boolean;
    };
    StatusBar: {
      overlaysWebView: boolean;
      style: "DARK" | "LIGHT";
      backgroundColor: string;
    };
  };
};

const config: MobileShellCapacitorConfig = {
  appId: "ru.holty.lobby",
  appName: "Lobby",
  webDir: "capacitor-shell",
  server: {
    url: "https://lobby.holty.ru",
    cleartext: false,
    androidScheme: "https",
    allowNavigation: ["lobby.holty.ru", "api.lobby.holty.ru"],
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    App: {
      disableBackButtonHandler: false,
    },
    Keyboard: {
      resize: "native",
      style: "DARK",
      resizeOnFullScreen: true,
    },
    StatusBar: {
      overlaysWebView: false,
      style: "DARK",
      backgroundColor: "#091018",
    },
  },
};

export default config;
