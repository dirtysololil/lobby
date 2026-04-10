import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { NativeMobileShell } from "@/components/app/native-mobile-shell";
import { PwaRegistration } from "@/components/app/pwa-registration";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lobby - private communication ecosystem",
  description:
    "Compact real-time communication platform for private conversations, hubs, live rooms, moderation and community control.",
  applicationName: "Lobby",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Lobby",
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  icons: {
    icon: [{ url: "/icon.png", sizes: "512x512", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: [{ url: "/icon.png", sizes: "512x512", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#101826",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className="antialiased">
        <NativeMobileShell />
        <PwaRegistration />
        {children}
      </body>
    </html>
  );
}
