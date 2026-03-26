import type { Metadata } from "next";
import { LandingClient } from "./landing-client";

export const metadata: Metadata = {
  title: "MindStore — Your Knowledge, Portable to Any AI",
  description:
    "Import from 12+ sources. Search by meaning. Connect to any AI via MCP. 35 plugins, community knowledge sharing, totally free and open source.",
  openGraph: {
    title: "MindStore — Your Knowledge, Portable to Any AI",
    description:
      "Import from ChatGPT, Kindle, YouTube, Notion & more. Chat with your own knowledge. Share minds. 35 plugins, MCP protocol, free & open source.",
    url: "https://www.mindstore.org",
    siteName: "MindStore",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MindStore — Your Knowledge, Portable to Any AI",
    description:
      "Import from 12+ sources. Search by meaning. Share & grow knowledge. 35 plugins. Free & open source.",
  },
};

export default function LandingPage() {
  return <LandingClient />;
}
