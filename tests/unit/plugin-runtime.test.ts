import { describe, expect, it } from "vitest";
import { defineMindStoreConfig, definePlugin } from "@mindstore/plugin-sdk";
import { createPluginRuntime } from "@mindstore/plugin-runtime";
import { pluginRuntime } from "@/server/plugins/runtime";

describe("plugin runtime", () => {
  it("resolves legacy aliases to canonical plugin slugs", () => {
    expect(pluginRuntime.resolveSlug("youtube-importer")).toBe("youtube-transcript");
    expect(pluginRuntime.resolveSlug("reddit-importer")).toBe("reddit-saved");
  });

  it("loads the sample external plugin from mindstore.config.ts", () => {
    const manifest = pluginRuntime.getManifest("community-hello");
    expect(manifest?.name).toBe("Community Hello");
    expect(manifest?.type).toBe("mcp");
  });

  it("runs capture hooks only for active installed plugins", async () => {
    const runtime = createPluginRuntime(
      defineMindStoreConfig({
        plugins: [
          definePlugin({
            manifest: {
              slug: "capture-active",
              name: "Capture Active",
              description: "Active capture plugin",
              version: "0.1.0",
              type: "extension",
              category: "import",
              icon: "sparkles",
              author: "MindStore",
            },
            hooks: {
              onCapture(context) {
                return {
                  modified: true,
                  data: {
                    pluginSlug: context.pluginSlug,
                    pluginConfig: context.pluginConfig,
                  },
                };
              },
            },
          }),
          definePlugin({
            manifest: {
              slug: "capture-disabled",
              name: "Capture Disabled",
              description: "Disabled capture plugin",
              version: "0.1.0",
              type: "extension",
              category: "import",
              icon: "sparkles",
              author: "MindStore",
            },
            hooks: {
              onCapture() {
                return {
                  modified: true,
                };
              },
            },
          }),
        ],
      })
    );

    const results = await runtime.runHookForActivePlugins(
      new Map([
        ["capture-active", { status: "active", config: { enabled: true } }],
        ["capture-disabled", { status: "disabled", config: { enabled: false } }],
      ]),
      "onCapture",
      {
        userId: "test-user",
        event: { surface: "unit-test" },
      }
    );

    expect(results).toHaveLength(1);
    expect(results[0]?.pluginSlug).toBe("capture-active");
    expect(results[0]?.result).toEqual({
      modified: true,
      data: {
        pluginSlug: "capture-active",
        pluginConfig: { enabled: true },
      },
    });
  });

  it("builds defaults and validates manifest-driven plugin settings", () => {
    const runtime = createPluginRuntime(
      defineMindStoreConfig({
        plugins: [
          definePlugin({
            manifest: {
              slug: "configurable",
              name: "Configurable Plugin",
              description: "Plugin with schema-backed settings",
              version: "0.1.0",
              type: "extension",
              category: "action",
              icon: "sparkles",
              author: "MindStore",
              ui: {
                settingsSchema: [
                  {
                    key: "enabled",
                    label: "Enabled",
                    type: "boolean",
                    default: true,
                  },
                  {
                    key: "batchSize",
                    label: "Batch Size",
                    type: "number",
                    default: 25,
                    validation: {
                      min: 1,
                      max: 50,
                    },
                  },
                  {
                    key: "mode",
                    label: "Mode",
                    type: "select",
                    required: true,
                    options: [
                      { label: "Fast", value: "fast" },
                      { label: "Accurate", value: "accurate" },
                    ],
                  },
                ],
              },
            },
          }),
        ],
      })
    );

    expect(runtime.buildDefaultConfig("configurable")).toEqual({
      enabled: true,
      batchSize: 25,
    });

    expect(
      runtime.validateAndNormalizeConfig("configurable", {
        enabled: "yes",
        batchSize: "12",
        mode: "fast",
      })
    ).toEqual({
      config: {
        enabled: true,
        batchSize: 12,
        mode: "fast",
      },
      errors: {},
      isValid: true,
    });

    const invalid = runtime.validateAndNormalizeConfig("configurable", {
      enabled: "maybe",
      batchSize: "80",
      mode: "turbo",
    });

    expect(invalid.isValid).toBe(false);
    expect(invalid.errors).toEqual({
      enabled: "Enabled must be true or false.",
      batchSize: "Batch Size must be at most 50.",
      mode: "Mode must be one of the allowed options.",
    });
  });
});
