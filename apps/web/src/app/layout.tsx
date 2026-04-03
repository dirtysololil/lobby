import type { Metadata } from "next";
import type { ReactNode } from "react";
import { IBM_Plex_Mono, Inter } from "next/font/google";
import "./globals.css";

const bodyFont = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-body",
});

const headingFont = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-heading",
});

const monoFont = IBM_Plex_Mono({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Lobby - private communication ecosystem",
  description:
    "Compact real-time communication platform for private conversations, hubs, live rooms, moderation and community control.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="ru">
      <body
        className={`${bodyFont.variable} ${headingFont.variable} ${monoFont.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
