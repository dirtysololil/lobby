import type { CapacitorConfig } from "@capacitor/cli";
import { KeyboardResize, KeyboardStyle } from "@capacitor/keyboard";

const config: CapacitorConfig = {
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
      resize: KeyboardResize.Native,
      style: KeyboardStyle.Dark,
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
