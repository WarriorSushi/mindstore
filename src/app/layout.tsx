import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MindStore — Your mind, searchable.",
  description: "Import your ChatGPT conversations, notes, and knowledge. Ask anything. Get synthesized answers from your own brain. 100% private — your data never leaves your browser.",
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
    description: "Import your ChatGPT conversations, notes, and knowledge. 100% private — runs entirely in your browser.",
  },
  metadataBase: new URL("https://mindstore.org"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#7c3aed" />
      </head>
      <body className={`${geist.variable} ${geistMono.variable} antialiased bg-zinc-950 text-zinc-100`}>
        {children}
        <Toaster theme="dark" />
      </body>
    </html>
  );
}
