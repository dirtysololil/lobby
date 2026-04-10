"use client";

import {
  usePathname,
  useRouter,
} from "next/navigation";
import { useEffect, useRef } from "react";
import {
  getCapacitorPlugins,
  isNativeCapacitorPlatform,
  removeCapacitorListener,
} from "@/lib/capacitor-runtime";

const nativeLastRouteStorageKey = "lobby:native:last-route";
const nativeResumeEventName = "lobby:native-resume";

export function NativeMobileShell() {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const didAttemptRestoreRef = useRef(false);
  const currentRoute = pathname;

  useEffect(() => {
    if (!isNativeCapacitorPlatform()) {
      return;
    }

    const plugins = getCapacitorPlugins();
    const appPlugin = plugins?.App;
    const keyboardPlugin = plugins?.Keyboard;
    const statusBarPlugin = plugins?.StatusBar;

    document.documentElement.classList.add("cap-native");
    document.body.classList.add("cap-native");
    document.documentElement.style.setProperty("--native-keyboard-height", "0px");

    void Promise.resolve(statusBarPlugin?.show?.()).catch(() => undefined);
    void Promise.resolve(
      statusBarPlugin?.setStyle?.({ style: "DARK" }),
    ).catch(() => undefined);
    void Promise.resolve(
      statusBarPlugin?.setOverlaysWebView?.({ overlay: false }),
    ).catch(() => undefined);
    void Promise.resolve(
      statusBarPlugin?.setBackgroundColor?.({ color: "#091018" }),
    ).catch(() => undefined);

    void Promise.resolve(
      keyboardPlugin?.setStyle?.({ style: "DARK" }),
    ).catch(() => undefined);
    void Promise.resolve(
      keyboardPlugin?.setResizeMode?.({ mode: "native" }),
    ).catch(() => undefined);
    void Promise.resolve(
      keyboardPlugin?.setAccessoryBarVisible?.({ isVisible: false }),
    ).catch(() => undefined);

    const onKeyboardShow = (height: number) => {
      document.documentElement.style.setProperty(
        "--native-keyboard-height",
        `${height}px`,
      );
      document.body.classList.add("native-keyboard-open");
    };

    const onKeyboardHide = () => {
      document.documentElement.style.setProperty("--native-keyboard-height", "0px");
      document.body.classList.remove("native-keyboard-open");
    };

    const emitResume = () => {
      window.dispatchEvent(new Event(nativeResumeEventName));
    };

    const keyboardWillShowHandle = keyboardPlugin?.addListener?.(
      "keyboardWillShow",
      (info) => {
        onKeyboardShow(info.keyboardHeight);
      },
    );
    const keyboardDidShowHandle = keyboardPlugin?.addListener?.(
      "keyboardDidShow",
      (info) => {
        onKeyboardShow(info.keyboardHeight);
      },
    );
    const keyboardWillHideHandle = keyboardPlugin?.addListener?.(
      "keyboardWillHide",
      onKeyboardHide,
    );
    const keyboardDidHideHandle = keyboardPlugin?.addListener?.(
      "keyboardDidHide",
      onKeyboardHide,
    );
    const appStateHandle = appPlugin?.addListener?.("appStateChange", (state) => {
      if (state.isActive) {
        emitResume();
      }
    });
    const resumeHandle = appPlugin?.addListener?.("resume", emitResume);

    return () => {
      document.documentElement.classList.remove("cap-native");
      document.body.classList.remove("cap-native", "native-keyboard-open");
      document.documentElement.style.setProperty("--native-keyboard-height", "0px");

      removeCapacitorListener(keyboardWillShowHandle);
      removeCapacitorListener(keyboardDidShowHandle);
      removeCapacitorListener(keyboardWillHideHandle);
      removeCapacitorListener(keyboardDidHideHandle);
      removeCapacitorListener(appStateHandle);
      removeCapacitorListener(resumeHandle);
    };
  }, []);

  useEffect(() => {
    if (!isNativeCapacitorPlatform() || didAttemptRestoreRef.current) {
      return;
    }

    didAttemptRestoreRef.current = true;

    if (pathname !== "/app" && pathname !== "/app/messages") {
      return;
    }

    try {
      const lastRoute = window.localStorage.getItem(nativeLastRouteStorageKey);

      if (
        !lastRoute ||
        lastRoute === currentRoute ||
        !lastRoute.startsWith("/app/")
      ) {
        return;
      }

      router.replace(lastRoute);
    } catch {
      // Ignore storage read issues and keep the current route.
    }
  }, [currentRoute, pathname, router]);

  useEffect(() => {
    if (!isNativeCapacitorPlatform() || !pathname.startsWith("/app")) {
      return;
    }

    try {
      window.localStorage.setItem(nativeLastRouteStorageKey, currentRoute);
    } catch {
      // Ignore storage write issues and keep the shell usable.
    }
  }, [currentRoute, pathname]);

  return null;
}
