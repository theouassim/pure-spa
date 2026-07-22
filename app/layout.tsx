import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { CookieBanner } from "@/components/CookieBanner";
import { TrackingScripts } from "@/components/TrackingScripts";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pure Spa Institut — Réservation",
  description: "Réservez votre soin en ligne chez Pure Spa Institut",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <CookieBanner />
        <TrackingScripts />
      </body>
    </html>
  );
}
