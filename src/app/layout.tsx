import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MindStore — Your mind, searchable.",
  description: "Import your ChatGPT conversations, notes, and knowledge. Ask anything. Get synthesized answers from your own brain. Self-hosted, private, and AI-powered.",
  keywords: ["mind storage", "knowledge base", "ChatGPT export", "personal AI", "MCP", "semantic search", "second brain"],
  authors: [{ name: "AltCorp" }],
  openGraph: {
    title: "MindStore — Your mind, searchable.",
    description: "Import your ChatGPT conversations, notes, and knowledge. Ask anything. Get answers from YOUR brain. 100% private.",
    url: "https://mindstore.org",
    siteName: "MindStore",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MindStore — Your mind, searchable.",
    description: "Import your ChatGPT conversations, notes, and knowledge. Self-hosted and AI-powered.",
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_URL || "https://mindstore-sandy.vercel.app"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#7c3aed" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className={`${geist.variable} ${geistMono.variable} antialiased bg-zinc-950 text-zinc-100 overscroll-none`}>
        {children}
        <Toaster theme="dark" position="top-center" />
      </body>
    </html>
  );
}
