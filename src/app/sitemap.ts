import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: "https://mindstore.frain.cloud", lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: "https://mindstore.frain.cloud/app", lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
  ];
}
