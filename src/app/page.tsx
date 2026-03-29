import type { Metadata } from "next";
import { LandingClient } from "./landing-client";

export const metadata: Metadata = {
  title: "MindStore — Your Knowledge, Portable to Any AI",
  description:
    "Import from 12+ sources. Search by meaning. Connect to any AI via MCP. Private by default when you enable auth, extensible by design.",
  openGraph: {
    title: "MindStore — Your Knowledge, Portable to Any AI",
    description:
      "Import from ChatGPT, Kindle, YouTube, Notion & more. Chat with your own knowledge. Bring your own AI. Keep user data isolated on public deployments.",
    url: "https://www.mindstore.org",
    siteName: "MindStore",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MindStore — Your Knowledge, Portable to Any AI",
    description:
      "Import from 12+ sources. Search by meaning. Bring your own AI. Open source memory infrastructure for serious users.",
  },
};

export default function LandingPage() {
  return <LandingClient />;
}
