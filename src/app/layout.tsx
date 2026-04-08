import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import AnalyticsProvider from "@/components/AnalyticsProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://frogo.tv"),
  title: "Frogo.tv — Watch Together",
  description:
    "Curated video channels you can watch together. Pair your phone as a remote.",
  icons: {
    icon: "/favicon.ico",
    apple: "/images/frogo/frogo-logo-200.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body suppressHydrationWarning className="h-full bg-black text-foreground font-sans overflow-hidden">
        <AnalyticsProvider>{children}</AnalyticsProvider>
      </body>
    </html>
  );
}
