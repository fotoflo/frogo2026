import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
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
  title: "Frogo.tv — Watch Together",
  description:
    "Curated video channels you can watch together. Pair your phone as a remote.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans">
        <nav className="border-b border-card-border px-6 py-4">
          <div className="mx-auto max-w-6xl flex items-center justify-between">
            <Link
              href="/"
              className="text-xl font-bold tracking-tight hover:text-accent transition-colors"
            >
              frogo.tv
            </Link>
            <div className="flex items-center gap-6 text-sm text-muted">
              <Link href="/" className="hidden sm:inline hover:text-foreground transition-colors">
                Channels
              </Link>
              <Link href="/mobile" className="sm:hidden hover:text-foreground transition-colors">
                Browse
              </Link>
              <Link
                href="/pair"
                className="hover:text-foreground transition-colors"
              >
                Pair Remote
              </Link>
            </div>
          </div>
        </nav>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
