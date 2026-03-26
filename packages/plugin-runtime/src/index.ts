import type {
  MindStoreConfig,
  MindStorePluginModule,
  PluginDashboardWidgetResult,
  PluginHookContext,
  PluginHookName,
  PluginJobResult,
  PluginManifest,
  PluginJobDefinition,
  PluginStatus,
  PluginStoreEntry,
  PluginPrompt,
  PluginMcpResource,
  PluginMcpTool,
  PluginSettingField,
  PluginWidget,
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

export interface PluginDashboardWidgetBinding {
  pluginSlug: string;
  definition: PluginWidget;
  pluginConfig: Record<string, unknown>;
  load: () => Promise<PluginDashboardWidgetResult>;
}

export interface PluginJobBinding {
  pluginSlug: string;
  definition: PluginJobDefinition;
  pluginConfig: Record<string, unknown>;
  run: (options?: { reason?: string; userId?: string }) => Promise<PluginJobResult>;
}

export interface PluginImportTabBinding {
  pluginSlug: string;
  definition: NonNullable<NonNullable<PluginManifest["ui"]>["importTab"]>;
  pluginConfig: Record<string, unknown>;
  openPath: string | null;
  routePath: string | null;
  source: "builtin" | "external";
}

export interface PluginConfigValidationResult {
  config: Record<string, unknown>;
  errors: Record<string, string>;
  isValid: boolean;
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

  for (const descriptor of plugins) {
    validateRuntimeSurfaces(descriptor.plugin);
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

  function getSettingsSchema(slug: string): PluginSettingField[] {
    return resolvePlugin(slug)?.descriptor.plugin.manifest.ui?.settingsSchema ?? [];
  }

  function getDashboardWidgetDefinitions(slug: string) {
    return resolvePlugin(slug)?.descriptor.plugin.manifest.ui?.dashboardWidgets ?? [];
  }

  function getJobDefinitions(slug: string): PluginJobDefinition[] {
    return resolvePlugin(slug)?.descriptor.plugin.manifest.jobs ?? [];
  }

  function getImportTabs(installedPlugins: Map<string, InstalledPluginState>): PluginImportTabBinding[] {
    return plugins.flatMap(({ plugin, source }) => {
      const installed = resolveInstalledState(plugin.manifest.slug, installedPlugins);
      if (!isPluginActive(installed) || !plugin.manifest.ui?.importTab) {
        return [];
      }

      return [
        {
          pluginSlug: plugin.manifest.slug,
          definition: plugin.manifest.ui.importTab,
          pluginConfig: installed?.config ?? {},
          openPath: resolvePluginPageHref(plugin.manifest),
          routePath: plugin.manifest.routes?.[0]?.path ?? null,
          source,
        },
      ];
    });
  }

  function buildDefaultConfig(slug: string): Record<string, unknown> {
    const schema = getSettingsSchema(slug);
    return schema.reduce<Record<string, unknown>>((configValues, field) => {
      if (field.default !== undefined) {
        configValues[field.key] = field.default;
      }

      return configValues;
    }, {});
  }

  function validateAndNormalizeConfig(
    slug: string,
    nextConfig: unknown,
    options: {
      existingConfig?: Record<string, unknown>;
      includeDefaults?: boolean;
    } = {}
  ): PluginConfigValidationResult {
    const schema = getSettingsSchema(slug);
    const existingConfig = isRecord(options.existingConfig) ? options.existingConfig : {};
    const incomingConfig = isRecord(nextConfig) ? nextConfig : {};

    if (!schema.length) {
      return {
        config: {
          ...existingConfig,
          ...incomingConfig,
        },
        errors: {},
        isValid: true,
      };
    }

    const normalizedConfig: Record<string, unknown> = { ...preserveUnknownConfig(existingConfig, schema) };
    const errors: Record<string, string> = {};

    for (const field of schema) {
      const sourceValue =
        incomingConfig[field.key] !== undefined
          ? incomingConfig[field.key]
          : existingConfig[field.key] !== undefined
            ? existingConfig[field.key]
            : options.includeDefaults
              ? field.default
              : undefined;

      if (sourceValue === undefined) {
        if (field.required) {
          errors[field.key] = `${field.label} is required.`;
        }
        continue;
      }

      const normalized = normalizeFieldValue(field, sourceValue);
      if (normalized.error) {
        errors[field.key] = normalized.error;
        continue;
      }

      if (normalized.value !== undefined) {
        normalizedConfig[field.key] = normalized.value;
      }
    }

    return {
      config: normalizedConfig,
      errors,
      isValid: Object.keys(errors).length === 0,
    };
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

  function getDashboardWidgets(
    installedPlugins: Map<string, InstalledPluginState>,
    options: { userId: string } 
  ): PluginDashboardWidgetBinding[] {
    return plugins.flatMap(({ plugin }) => {
      const installed = resolveInstalledState(plugin.manifest.slug, installedPlugins);
      if (!isPluginActive(installed)) {
        return [];
      }

      const widgetHandlers = plugin.dashboard?.widgets ?? [];
      const widgetDefinitions = new Map(
        (plugin.manifest.ui?.dashboardWidgets ?? []).map((widget) => [widget.id, widget])
      );

      return widgetHandlers.flatMap((widget) => {
        const definition = widgetDefinitions.get(widget.id);
        if (!definition) {
          return [];
        }

        return [
          {
            pluginSlug: plugin.manifest.slug,
            definition,
            pluginConfig: installed?.config ?? {},
            load: async () =>
              await widget.load({
                userId: options.userId,
                pluginSlug: plugin.manifest.slug,
                pluginConfig: installed?.config ?? {},
              }),
          },
        ];
      });
    });
  }

  function getJobs(
    installedPlugins: Map<string, InstalledPluginState>,
    options: { userId: string; slug?: string }
  ): PluginJobBinding[] {
    return plugins.flatMap(({ plugin }) => {
      if (options.slug && plugin.manifest.slug !== options.slug) {
        return [];
      }

      const installed = resolveInstalledState(plugin.manifest.slug, installedPlugins);
      if (!isPluginActive(installed)) {
        return [];
      }

      const jobHandlers = plugin.jobs ?? [];
      const jobDefinitions = new Map(
        (plugin.manifest.jobs ?? []).map((job) => [job.id, job])
      );

      return jobHandlers.flatMap((job) => {
        const definition = jobDefinitions.get(job.id);
        if (!definition) {
          return [];
        }

        return [
          {
            pluginSlug: plugin.manifest.slug,
            definition,
            pluginConfig: installed?.config ?? {},
            run: async (jobOptions = {}) =>
              await job.run({
                userId: jobOptions.userId ?? options.userId,
                pluginSlug: plugin.manifest.slug,
                pluginConfig: installed?.config ?? {},
                reason: jobOptions.reason,
              }),
          },
        ];
      });
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
    getSettingsSchema,
    getDashboardWidgetDefinitions,
    getJobDefinitions,
    getImportTabs,
    buildDefaultConfig,
    validateAndNormalizeConfig,
    resolveSlug,
    resolvePlugin,
    buildStoreCatalog,
    getMcpTools,
    getMcpResources,
    getPrompts,
    getDashboardWidgets,
    getJobs,
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
  if (manifest.ui?.dashboardWidgets?.length) tags.push("dashboard");
  if (manifest.jobs?.length) tags.push("jobs");
  return tags;
}

function resolvePluginPageHref(manifest: PluginManifest): string | null {
  const firstPage = manifest.ui?.pages?.[0];
  if (!firstPage?.path) {
    return null;
  }

  return firstPage.path.startsWith("/") ? firstPage.path : `/app/${firstPage.path}`;
}

function validateRuntimeSurfaces(plugin: MindStorePluginModule) {
  const widgetIds = new Set((plugin.manifest.ui?.dashboardWidgets ?? []).map((widget) => widget.id));
  for (const widget of plugin.dashboard?.widgets ?? []) {
    if (!widgetIds.has(widget.id)) {
      throw new Error(
        `Plugin ${plugin.manifest.slug} defines dashboard widget handler "${widget.id}" without a manifest ui.dashboardWidgets entry.`
      );
    }
  }

  const jobIds = new Set((plugin.manifest.jobs ?? []).map((job) => job.id));
  for (const job of plugin.jobs ?? []) {
    if (!jobIds.has(job.id)) {
      throw new Error(
        `Plugin ${plugin.manifest.slug} defines job handler "${job.id}" without a manifest jobs entry.`
      );
    }
  }
}

function preserveUnknownConfig(
  config: Record<string, unknown>,
  schema: PluginSettingField[]
): Record<string, unknown> {
  const knownKeys = new Set(schema.map((field) => field.key));

  return Object.fromEntries(
    Object.entries(config).filter(([key]) => !knownKeys.has(key))
  );
}

function normalizeFieldValue(
  field: PluginSettingField,
  rawValue: unknown
): { value?: unknown; error?: string } {
  switch (field.type) {
    case "boolean":
      return normalizeBooleanField(field, rawValue);
    case "number":
      return normalizeNumberField(field, rawValue);
    case "select":
      return normalizeSelectField(field, rawValue);
    case "text":
    case "textarea":
    case "password":
    case "file":
      return normalizeStringField(field, rawValue);
    default:
      return { error: `Unsupported field type: ${field.type}` };
  }
}

function normalizeBooleanField(
  field: PluginSettingField,
  rawValue: unknown
): { value?: boolean; error?: string } {
  if (typeof rawValue === "boolean") {
    return { value: rawValue };
  }

  if (typeof rawValue === "string") {
    const normalized = rawValue.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) {
      return { value: true };
    }

    if (["false", "0", "no", "off"].includes(normalized)) {
      return { value: false };
    }
  }

  return { error: `${field.label} must be true or false.` };
}

function normalizeNumberField(
  field: PluginSettingField,
  rawValue: unknown
): { value?: number; error?: string } {
  const value =
    typeof rawValue === "number"
      ? rawValue
      : typeof rawValue === "string" && rawValue.trim().length > 0
        ? Number(rawValue)
        : Number.NaN;

  if (!Number.isFinite(value)) {
    return { error: `${field.label} must be a valid number.` };
  }

  if (field.validation?.min !== undefined && value < field.validation.min) {
    return { error: field.validation.message ?? `${field.label} must be at least ${field.validation.min}.` };
  }

  if (field.validation?.max !== undefined && value > field.validation.max) {
    return { error: field.validation.message ?? `${field.label} must be at most ${field.validation.max}.` };
  }

  return { value };
}

function normalizeSelectField(
  field: PluginSettingField,
  rawValue: unknown
): { value?: string; error?: string } {
  const normalized = typeof rawValue === "string" ? rawValue.trim() : String(rawValue ?? "").trim();
  if (!normalized) {
    if (field.required) {
      return { error: `${field.label} is required.` };
    }

    return { value: "" };
  }

  const validOptions = new Set((field.options ?? []).map((option) => option.value));
  if (validOptions.size > 0 && !validOptions.has(normalized)) {
    return { error: `${field.label} must be one of the allowed options.` };
  }

  return { value: normalized };
}

function normalizeStringField(
  field: PluginSettingField,
  rawValue: unknown
): { value?: string; error?: string } {
  const normalized = typeof rawValue === "string" ? rawValue.trim() : String(rawValue ?? "").trim();

  if (!normalized && field.required) {
    return { error: `${field.label} is required.` };
  }

  if (field.validation?.pattern) {
    const matcher = new RegExp(field.validation.pattern);
    if (normalized && !matcher.test(normalized)) {
      return { error: field.validation.message ?? `${field.label} has an invalid format.` };
    }
  }

  return { value: normalized };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
