"use client";

import { Capacitor } from "@capacitor/core";
import { useEffect } from "react";

export function PwaRegistration() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    if (
      process.env.NODE_ENV !== "production" ||
      Capacitor.isNativePlatform()
    ) {
      void navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          void registration.unregister();
        });
      });
      return;
    }

    const registerWorker = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });
      } catch (error) {
        console.warn("[pwa] service worker registration failed", error);
      }
    };

    void registerWorker();
  }, []);

  return null;
}
