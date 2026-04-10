"use client";

export interface CapacitorListenerHandle {
  remove: () => Promise<void> | void;
}

export type CapacitorListenerRegistration =
  | CapacitorListenerHandle
  | Promise<CapacitorListenerHandle>;

export interface CapacitorAppPlugin {
  addListener?: {
    (
      eventName: "appStateChange",
      listener: (state: { isActive: boolean }) => void,
    ): CapacitorListenerRegistration;
    (
      eventName: "resume",
      listener: () => void,
    ): CapacitorListenerRegistration;
  };
}

export interface CapacitorKeyboardPlugin {
  setStyle?: (options: { style: "DARK" | "LIGHT" }) => Promise<void> | void;
  setResizeMode?: (
    options: { mode: "native" | "body" | "ionic" | "none" },
  ) => Promise<void> | void;
  setAccessoryBarVisible?: (
    options: { isVisible: boolean },
  ) => Promise<void> | void;
  addListener?: {
    (
      eventName: "keyboardWillShow" | "keyboardDidShow",
      listener: (info: { keyboardHeight: number }) => void,
    ): CapacitorListenerRegistration;
    (
      eventName: "keyboardWillHide" | "keyboardDidHide",
      listener: () => void,
    ): CapacitorListenerRegistration;
  };
}

export interface CapacitorStatusBarPlugin {
  show?: () => Promise<void> | void;
  setStyle?: (options: { style: "DARK" | "LIGHT" }) => Promise<void> | void;
  setOverlaysWebView?: (
    options: { overlay: boolean },
  ) => Promise<void> | void;
  setBackgroundColor?: (
    options: { color: string },
  ) => Promise<void> | void;
}

export interface CapacitorPluginRegistry {
  App?: CapacitorAppPlugin;
  Keyboard?: CapacitorKeyboardPlugin;
  StatusBar?: CapacitorStatusBarPlugin;
}

export interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  Plugins?: CapacitorPluginRegistry;
}

declare global {
  interface Window {
    Capacitor?: CapacitorGlobal;
  }
}

export function getCapacitorPlugins(): CapacitorPluginRegistry | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.Capacitor?.Plugins ?? null;
}

export function isNativeCapacitorPlatform(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const runtime = window.Capacitor;

  if (!runtime) {
    return false;
  }

  if (typeof runtime.isNativePlatform === "function") {
    try {
      return runtime.isNativePlatform();
    } catch {
      return false;
    }
  }

  if (typeof runtime.getPlatform === "function") {
    try {
      return runtime.getPlatform() !== "web";
    } catch {
      return false;
    }
  }

  return false;
}

export function removeCapacitorListener(
  registration: CapacitorListenerRegistration | null | undefined,
): void {
  if (!registration) {
    return;
  }

  void Promise.resolve(registration)
    .then((listener) => listener.remove())
    .catch(() => undefined);
}
