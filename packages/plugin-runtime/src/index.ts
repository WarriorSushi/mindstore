import type {
  MindStoreConfig,
  MindStorePluginModule,
  PluginHookContext,
  PluginHookName,
  PluginManifest,
  PluginStatus,
  PluginStoreEntry,
  PluginPrompt,
  PluginMcpResource,
  PluginMcpTool,
} from "@mindstore/plugin-sdk";

export interface InstalledPluginState {
  status: PluginStatus | string;
  config: Record<string, unknown>;
}

interface PluginDescriptor {
  plugin: MindStorePluginModule;
  source: "builtin" | "external";
}

interface PluginResolution {
  slug: string;
  descriptor: PluginDescriptor;
}

export interface PluginHookExecutionResult {
  pluginSlug: string;
  event?: unknown;
  result: unknown;
}

export interface PluginToolBinding {
  pluginSlug: string;
  tool: PluginMcpTool;
  pluginConfig: Record<string, unknown>;
}

export interface PluginResourceBinding {
  pluginSlug: string;
  resource: PluginMcpResource;
  pluginConfig: Record<string, unknown>;
}

export interface PluginPromptBinding {
  pluginSlug: string;
  prompt: PluginPrompt;
  pluginConfig: Record<string, unknown>;
}

export function createPluginRuntime(config: MindStoreConfig) {
  const plugins = config.plugins.map((plugin) => ({
    plugin,
    source: plugin.source ?? "builtin",
  }));

  const slugMap = new Map<string, PluginDescriptor>();
  const aliasMap = new Map<string, string>();

  for (const descriptor of plugins) {
    const slug = descriptor.plugin.manifest.slug;
    if (slugMap.has(slug)) {
      throw new Error(`Duplicate plugin slug detected: ${slug}`);
    }

    slugMap.set(slug, descriptor);

    for (const alias of descriptor.plugin.manifest.aliases ?? []) {
      if (aliasMap.has(alias) || slugMap.has(alias)) {
        throw new Error(`Duplicate plugin alias detected: ${alias}`);
      }
      aliasMap.set(alias, slug);
    }
  }

  function resolveSlug(slug: string): string | null {
    if (slugMap.has(slug)) {
      return slug;
    }

    return aliasMap.get(slug) ?? null;
  }

  function resolvePlugin(slug: string): PluginResolution | null {
    const canonicalSlug = resolveSlug(slug);
    if (!canonicalSlug) {
      return null;
    }

    const descriptor = slugMap.get(canonicalSlug);
    if (!descriptor) {
      return null;
    }

    return {
      slug: canonicalSlug,
      descriptor,
    };
  }

  function getAllPlugins(): MindStorePluginModule[] {
    return plugins.map((descriptor) => descriptor.plugin);
  }

  function getManifest(slug: string): PluginManifest | undefined {
    return resolvePlugin(slug)?.descriptor.plugin.manifest;
  }

  function getAllManifests(): PluginManifest[] {
    return getAllPlugins().map((plugin) => plugin.manifest);
  }

  function buildStoreCatalog(
    installedPlugins: Map<string, InstalledPluginState>,
    featuredSlugs: string[] = []
  ): PluginStoreEntry[] {
    return plugins.map(({ plugin, source }) => {
      const installed = resolveInstalledState(plugin.manifest.slug, installedPlugins);
      return {
        slug: plugin.manifest.slug,
        name: plugin.manifest.name,
        description: plugin.manifest.description,
        longDescription: plugin.manifest.longDescription,
        version: plugin.manifest.version,
        type: plugin.manifest.type,
        category: plugin.manifest.category,
        icon: plugin.manifest.icon,
        author: plugin.manifest.author,
        capabilities: plugin.manifest.capabilities,
        installed: !!installed,
        status: installed?.status as PluginStatus | undefined,
        featured: featuredSlugs.includes(plugin.manifest.slug),
        tags: buildTags(plugin.manifest),
        source,
      };
    });
  }

  function getMcpTools(installedPlugins: Map<string, InstalledPluginState>): PluginToolBinding[] {
    return plugins.flatMap(({ plugin }) => {
      const installed = resolveInstalledState(plugin.manifest.slug, installedPlugins);
      if (!isPluginActive(installed)) {
        return [];
      }

      return (plugin.mcp?.tools ?? []).map((tool) => ({
        pluginSlug: plugin.manifest.slug,
        tool,
        pluginConfig: installed?.config ?? {},
      }));
    });
  }

  function getMcpResources(installedPlugins: Map<string, InstalledPluginState>): PluginResourceBinding[] {
    return plugins.flatMap(({ plugin }) => {
      const installed = resolveInstalledState(plugin.manifest.slug, installedPlugins);
      if (!isPluginActive(installed)) {
        return [];
      }

      return (plugin.mcp?.resources ?? []).map((resource) => ({
        pluginSlug: plugin.manifest.slug,
        resource,
        pluginConfig: installed?.config ?? {},
      }));
    });
  }

  function getPrompts(installedPlugins: Map<string, InstalledPluginState>): PluginPromptBinding[] {
    return plugins.flatMap(({ plugin }) => {
      const installed = resolveInstalledState(plugin.manifest.slug, installedPlugins);
      if (!isPluginActive(installed)) {
        return [];
      }

      return (plugin.mcp?.prompts ?? []).map((prompt) => ({
        pluginSlug: plugin.manifest.slug,
        prompt,
        pluginConfig: installed?.config ?? {},
      }));
    });
  }

  async function runHookForPlugin(
    slug: string,
    hookName: PluginHookName,
    context: Omit<PluginHookContext, "pluginSlug">
  ) {
    const resolution = resolvePlugin(slug);
    if (!resolution) {
      return null;
    }

    const hook = resolution.descriptor.plugin.hooks?.[hookName];
    if (!hook) {
      return null;
    }

    return await hook({
      ...context,
      pluginSlug: resolution.slug,
    });
  }

  async function runHookForActivePlugins(
    installedPlugins: Map<string, InstalledPluginState>,
    hookName: PluginHookName,
    context: Omit<PluginHookContext, "pluginSlug" | "pluginConfig">
  ): Promise<PluginHookExecutionResult[]> {
    const results: Array<PluginHookExecutionResult | null> = await Promise.all(
      plugins.map(async ({ plugin }) => {
        const installed = resolveInstalledState(plugin.manifest.slug, installedPlugins);
        if (!isPluginActive(installed)) {
          return null;
        }

        const hook = plugin.hooks?.[hookName];
        if (!hook) {
          return null;
        }

        const result = await hook({
          ...context,
          pluginSlug: plugin.manifest.slug,
          pluginConfig: installed?.config ?? {},
        });

        const executionResult: PluginHookExecutionResult = {
          pluginSlug: plugin.manifest.slug,
          result: result ?? null,
        };

        if ("event" in context && context.event !== undefined) {
          executionResult.event = context.event;
        }

        return executionResult;
      })
    );

    return results.filter((result): result is PluginHookExecutionResult => result !== null);
  }

  return {
    config,
    getAllPlugins,
    getAllManifests,
    getManifest,
    resolveSlug,
    resolvePlugin,
    buildStoreCatalog,
    getMcpTools,
    getMcpResources,
    getPrompts,
    runHookForPlugin,
    runHookForActivePlugins,
  };
}

function resolveInstalledState(
  slug: string,
  installedPlugins: Map<string, InstalledPluginState>
): InstalledPluginState | undefined {
  return installedPlugins.get(slug);
}

function isPluginActive(installed?: InstalledPluginState): boolean {
  return !!installed && installed.status !== "disabled" && installed.status !== "error";
}

function buildTags(manifest: PluginManifest): string[] {
  const tags: string[] = [manifest.category];
  if (manifest.type === "mcp") tags.push("mcp");
  if (manifest.type === "prompt") tags.push("config-only");
  if (manifest.capabilities?.includes("network:fetch")) tags.push("network");
  if (manifest.capabilities?.includes("background:jobs")) tags.push("background");
  if (manifest.ui?.importTab) tags.push("file-upload");
  if (manifest.ui?.pages?.length) tags.push("has-pages");
  return tags;
}
