import type { Metadata, Viewport } from "next";
import { Fraunces, IBM_Plex_Mono, Inter } from "next/font/google";

import { Providers } from "./providers";
import "./globals.css";

/**
 * Design spec fonts (design.md):
 *   Display / headline  → Fraunces (editorial serif)
 *   Body / UI           → Inter (400, 500, 600)
 *   Mono / data / brand → IBM Plex Mono (400, 500)
 */
const fraunces = Fraunces({
  subsets: ["latin"],
  // Variable font — axes require weight to be absent (next/font rule).
  // Weight and style are controlled via CSS font-weight/font-style instead.
  axes: ["opsz", "SOFT", "WONK"],
  variable: "--font-display",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Rolewire — headless job posting and application API",
    template: "%s · Rolewire",
  },
  description:
    "Post jobs, collect applications, and keep the files in your own storage. Rolewire is a headless API — you build the career page.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  openGraph: {
    type: "website",
    siteName: "Rolewire",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0c0f0d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${inter.variable} ${ibmPlexMono.variable}`}
    >
      <body className="min-h-dvh">
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
