import { db, schema } from "@/server/db";
import type { InstalledPluginState } from "@mindstore/plugin-runtime";

export async function getInstalledPluginRows() {
  return db.select().from(schema.plugins);
}

export async function getInstalledPluginMap(): Promise<Map<string, InstalledPluginState>> {
  const installedPlugins = await getInstalledPluginRows();

  return new Map(
    installedPlugins.map((plugin) => [
      plugin.slug,
      {
        status: plugin.status,
        config: (plugin.config as Record<string, unknown>) || {},
      } satisfies InstalledPluginState,
    ])
  );
}
