import type { MetadataRoute } from "next";
import { runtimeConfig } from "@/lib/runtime-config";

export default function manifest(): MetadataRoute.Manifest {
  const appName = runtimeConfig.appName || "Lobby";

  return {
    name: `${appName} Messenger`,
    short_name: appName,
    description:
      "Lobby объединяет личные сообщения, звонки, хабы и приватные сообщества в одном приложении.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#09101a",
    theme_color: "#101826",
    lang: "ru",
    categories: ["communication", "social", "productivity"],
    icons: [
      {
        src: "/pwa/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
