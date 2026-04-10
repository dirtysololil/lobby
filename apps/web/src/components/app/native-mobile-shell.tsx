"use client";

import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import {
  Keyboard,
  KeyboardResize,
  KeyboardStyle,
} from "@capacitor/keyboard";
import { StatusBar, Style } from "@capacitor/status-bar";
import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import { useEffect, useMemo, useRef } from "react";

const nativeLastRouteStorageKey = "lobby:native:last-route";
const nativeResumeEventName = "lobby:native-resume";

export function NativeMobileShell() {
  const pathname = usePathname() ?? "/";
  const searchParams = useSearchParams();
  const router = useRouter();
  const didAttemptRestoreRef = useRef(false);
  const currentRoute = useMemo(() => {
    const serializedSearch = searchParams?.toString();

    return serializedSearch ? `${pathname}?${serializedSearch}` : pathname;
  }, [pathname, searchParams]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    document.documentElement.classList.add("cap-native");
    document.body.classList.add("cap-native");
    document.documentElement.style.setProperty("--native-keyboard-height", "0px");

    void StatusBar.show().catch(() => undefined);
    void StatusBar.setStyle({ style: Style.Dark }).catch(() => undefined);
    void StatusBar.setOverlaysWebView({ overlay: false }).catch(() => undefined);
    void StatusBar.setBackgroundColor({ color: "#091018" }).catch(() => undefined);

    void Keyboard.setStyle({ style: KeyboardStyle.Dark }).catch(() => undefined);
    void Keyboard.setResizeMode({ mode: KeyboardResize.Native }).catch(() => undefined);
    void Keyboard.setAccessoryBarVisible({ isVisible: false }).catch(
      () => undefined,
    );

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

    const keyboardWillShowHandle = Keyboard.addListener(
      "keyboardWillShow",
      (info) => {
        onKeyboardShow(info.keyboardHeight);
      },
    );
    const keyboardDidShowHandle = Keyboard.addListener(
      "keyboardDidShow",
      (info) => {
        onKeyboardShow(info.keyboardHeight);
      },
    );
    const keyboardWillHideHandle = Keyboard.addListener(
      "keyboardWillHide",
      onKeyboardHide,
    );
    const keyboardDidHideHandle = Keyboard.addListener(
      "keyboardDidHide",
      onKeyboardHide,
    );
    const appStateHandle = App.addListener("appStateChange", (state) => {
      if (state.isActive) {
        emitResume();
      }
    });
    const resumeHandle = App.addListener("resume", emitResume);

    return () => {
      document.documentElement.classList.remove("cap-native");
      document.body.classList.remove("cap-native", "native-keyboard-open");
      document.documentElement.style.setProperty("--native-keyboard-height", "0px");

      void keyboardWillShowHandle.then((listener) => listener.remove());
      void keyboardDidShowHandle.then((listener) => listener.remove());
      void keyboardWillHideHandle.then((listener) => listener.remove());
      void keyboardDidHideHandle.then((listener) => listener.remove());
      void appStateHandle.then((listener) => listener.remove());
      void resumeHandle.then((listener) => listener.remove());
    };
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || didAttemptRestoreRef.current) {
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
    if (!Capacitor.isNativePlatform() || !pathname.startsWith("/app")) {
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
