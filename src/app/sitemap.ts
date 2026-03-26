import { MetadataRoute } from "next";
import { readdirSync, statSync } from "fs";
import { join, relative } from "path";

const BASE_URL = process.env.NEXT_PUBLIC_URL || "https://mindstore.org";

/** Recursively collect all .md files under a directory */
function collectDocSlugs(dir: string, base: string): string[] {
  const slugs: string[] = [];
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        slugs.push(...collectDocSlugs(full, base));
      } else if (entry.name.endsWith(".md")) {
        let slug = relative(base, full).replace(/\.md$/, "");
        // index.md → directory root
        if (slug === "index" || slug.endsWith("/index")) {
          slug = slug.replace(/\/?index$/, "");
        }
        if (slug) slugs.push(slug);
      }
    }
  } catch {
    // docs dir may not exist at build time
  }
  return slugs;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  // Core pages
  const pages: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE_URL}/docs`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE_URL}/app`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
  ];

  // Doc pages
  const docsDir = join(process.cwd(), "docs");
  const docSlugs = collectDocSlugs(docsDir, docsDir);
  for (const slug of docSlugs) {
    // Skip internal codex worklog/convergence docs from sitemap
    if (slug.startsWith("codex/")) continue;
    // Skip release notes (too many, low SEO value)
    if (slug.startsWith("releases/")) continue;

    const priority = slug.startsWith("getting-started") ? 0.8
      : slug.startsWith("plugins/") ? 0.6
      : slug.startsWith("api") ? 0.5
      : 0.7;

    pages.push({
      url: `${BASE_URL}/docs/${slug}`,
      lastModified: now,
      changeFrequency: "monthly",
      priority,
    });
  }

  return pages;
}
