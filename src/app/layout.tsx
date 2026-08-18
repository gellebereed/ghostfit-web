import type { Metadata, Viewport } from "next";
import { Inter, Rajdhani, Anton } from "next/font/google";
import InstallPrompt from "@/components/InstallPrompt";
import AuraTheme from "@/components/AuraTheme";
import Atmosphere from "@/components/Atmosphere";
import "./globals.css";

// Self-hosted at build time — no external round-trip, no FOUT, no layout shift.
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

const rajdhani = Rajdhani({
  subsets: ["latin"],
  weight: ["600", "700"],
  display: "swap",
  variable: "--font-display-face",
});

// Poster type for hero moments — compressed, heavy, unapologetic. This is the
// voice that makes a screen feel like a Nike campaign rather than a dashboard.
const anton = Anton({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--font-hero-face",
});

export const metadata: Metadata = {
  title: "GhostFit – Battle Your Past Self",
  description: "Gamified fitness app where you fight your ghost",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" }
    ],
    shortcut: "/favicon.svg",
    apple: [
      { url: "/apple-icon.png", sizes: "180x180", type: "image/png" }
    ]
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "GhostFit",
  },
};
export const viewport: Viewport = {
  width: "device-width", initialScale: 1, maximumScale: 1, themeColor: "#0A0A0A",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${rajdhani.variable} ${anton.variable}`}>
      <body>
        <Atmosphere />
        <div className="app">
          <AuraTheme />
          {children}
          <InstallPrompt />
        </div>
      </body>
    </html>
  );
}
