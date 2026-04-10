"use client";

import { useEffect } from "react";
import { isNativeCapacitorPlatform } from "@/lib/capacitor-runtime";

export function PwaRegistration() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    if (
      process.env.NODE_ENV !== "production" ||
      isNativeCapacitorPlatform()
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
