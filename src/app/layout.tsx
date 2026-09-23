import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Instrument_Sans, Instrument_Serif } from "next/font/google";

import { AppHeader } from "@/components/AppHeader";
import { NewPartyProvider } from "@/components/NewPartyProvider";
import { authEnabled } from "@/lib/auth";

import "./globals.css";

const sans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument-sans",
  display: "swap",
});

const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-instrument-serif",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Accountly", template: "%s · Accountly" },
  description:
    "A quiet ledger for the people and shops you deal with — log what you received and what you paid.",
  applicationName: "Accountly",
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#fbf7f0",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable} ${mono.variable}`}>
      <body className="min-h-dvh bg-canvas antialiased">
        <NewPartyProvider>
          <div className="min-h-dvh px-4 pb-24">
            <div className="mx-auto w-full max-w-[780px]">
              <AppHeader canSignOut={authEnabled()} />
              <main>{children}</main>
            </div>
          </div>
        </NewPartyProvider>
      </body>
    </html>
  );
}
