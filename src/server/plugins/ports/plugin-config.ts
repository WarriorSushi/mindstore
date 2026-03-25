import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { PLUGIN_MANIFESTS } from "@/server/plugins/registry";

export async function ensurePluginInstalled(slug: string) {
  const manifest = PLUGIN_MANIFESTS[slug];
  const [existing] = await db
    .select()
    .from(schema.plugins)
    .where(eq(schema.plugins.slug, slug))
    .limit(1);

  if (existing || !manifest) {
    return;
  }

  await db.insert(schema.plugins).values({
    slug: manifest.slug,
    name: manifest.name,
    description: manifest.description,
    version: manifest.version,
    type: manifest.type,
    status: "active",
    icon: manifest.icon,
    category: manifest.category,
    author: manifest.author,
    metadata: {
      capabilities: manifest.capabilities,
      hooks: manifest.hooks,
      routes: manifest.routes,
      mcpTools: manifest.mcpTools,
      aliases: manifest.aliases || [],
      dashboardWidgets: manifest.ui?.dashboardWidgets || [],
      jobs: manifest.jobs || [],
      jobRuns: {},
    },
  });
}

export async function getPluginConfig<T extends object>(slug: string, fallback: T): Promise<T> {
  const [row] = await db
    .select({ config: schema.plugins.config })
    .from(schema.plugins)
    .where(eq(schema.plugins.slug, slug))
    .limit(1);

  if (!row?.config || typeof row.config !== "object" || Array.isArray(row.config)) {
    return { ...fallback };
  }

  return {
    ...fallback,
    ...(row.config as Partial<T>),
  };
}

export async function savePluginConfig<T extends object>(slug: string, config: T) {
  await db
    .update(schema.plugins)
    .set({
      config,
      updatedAt: new Date(),
    })
    .where(eq(schema.plugins.slug, slug));
}

export async function updatePluginConfig<T extends object>(
  slug: string,
  fallback: T,
  updater: (config: T) => T,
) {
  const current = await getPluginConfig(slug, fallback);
  const next = updater(current);
  await savePluginConfig(slug, next);
  return next;
}

export function createPluginScopedId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function stripMarkdownFence(value: string) {
  return value.trim().replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "");
}

export function parseJsonValue<T>(value: string): T {
  return JSON.parse(stripMarkdownFence(value)) as T;
}
