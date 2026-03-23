import { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_URL || "https://mindstore-sandy.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${BASE_URL}/app`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
  ];
}
