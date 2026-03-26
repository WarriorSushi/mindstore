import type { Metadata } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

/**
 * Typography System
 * 
 * Plus Jakarta Sans — Body & UI. Geometric, premium, wide letterforms.
 * Instrument Serif — Display headings (landing page only). Editorial, distinctive.
 * JetBrains Mono — Code. Best-in-class monospace with coding ligatures.
 * 
 * The serif/sans pairing creates real contrast — editorial headlines
 * with clean product UI. Not two similar sans fighting each other.
 */
const sans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const serif = Instrument_Serif({
  variable: "--font-serif",
  subsets: ["latin"],
  display: "swap",
  weight: ["400"],
  style: ["normal", "italic"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "MindStore — Your AI-Powered Second Brain",
  description: "Import knowledge from 12+ sources. Chat with your own mind. Discover hidden connections. 35 plugins, MCP protocol, free and open source.",
  keywords: ["second brain", "knowledge base", "personal AI", "ChatGPT export", "MCP", "semantic search", "knowledge management", "AI tools", "open source"],
  authors: [{ name: "MindStore" }],
  openGraph: {
    title: "MindStore — Your AI-Powered Second Brain",
    description: "Import from ChatGPT, Kindle, YouTube, Notion & more. Chat with your own knowledge. 35 plugins, MCP protocol, free & open source.",
    url: "https://mindstore.org",
    siteName: "MindStore",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MindStore — Your AI-Powered Second Brain",
    description: "Import from 12+ sources. Chat with your own mind. 35 plugins. Free & open source.",
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_URL || "https://mindstore.org"),
  alternates: {
    canonical: "/",
  },
  other: {
    "msapplication-TileColor": "#0a0a0b",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="theme-color" content="#14b8a6" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        {/* Preconnect to font origins for faster LCP */}
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* DNS-prefetch for common AI provider APIs */}
        <link rel="dns-prefetch" href="https://generativelanguage.googleapis.com" />
        <link rel="dns-prefetch" href="https://api.openai.com" />
      </head>
      <body className={`${sans.variable} ${serif.variable} ${mono.variable} font-sans antialiased bg-zinc-950 text-zinc-100 overscroll-none`}>
        {children}
        <Toaster
          theme="dark"
          position="top-center"
          toastOptions={{
            style: {
              background: "#111113",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "16px",
              color: "#e4e4e7",
              fontSize: "13px",
              fontWeight: 500,
              boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
              backdropFilter: "blur(12px)",
            },
          }}
        />
      </body>
    </html>
  );
}
