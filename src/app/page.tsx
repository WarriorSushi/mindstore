import type { Metadata } from "next";
import { LandingClient } from "./landing-client";

export const metadata: Metadata = {
  title: "MindStore — Your AI-Powered Second Brain",
  description:
    "Import knowledge from 12+ sources. Chat with your own mind. Discover hidden connections. 35 built-in plugins, MCP protocol, totally free and open source.",
  openGraph: {
    title: "MindStore — Your AI-Powered Second Brain",
    description:
      "Import from ChatGPT, Kindle, YouTube, Notion & more. Chat with your own knowledge. 35 plugins, MCP protocol, free & open source.",
    url: "https://www.mindstore.org",
    siteName: "MindStore",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MindStore — Your AI-Powered Second Brain",
    description:
      "Import from 12+ sources. Chat with your own mind. 35 plugins. Free & open source.",
  },
};

export default function LandingPage() {
  return <LandingClient />;
}
