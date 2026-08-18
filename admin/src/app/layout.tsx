import type { Metadata, Viewport } from "next";

import { Providers } from "./providers";
import "./globals.css";

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
  themeColor: "#18181b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      {/*
        No webfont: the UI uses the platform sans stack (see tailwind.config.ts). That keeps the
        Docker build hermetic — no font download at build time — and matches spec §7's "single
        well-set system/Inter-class sans".
      */}
      <body className="min-h-dvh">
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
