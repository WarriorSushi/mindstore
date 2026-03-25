import { describe, expect, it } from "vitest";
import { createPluginRuntime } from "@mindstore/plugin-runtime";
import { defineMindStoreConfig, definePlugin } from "@mindstore/plugin-sdk";
import { applyDocumentHookTransforms } from "@/server/plugins/ingestion";

describe("plugin-aware ingestion", () => {
  it("discovers active import tabs from the runtime", () => {
    const runtime = createPluginRuntime(
      defineMindStoreConfig({
        plugins: [
          definePlugin({
            manifest: {
              slug: "import-runtime",
              name: "Import Runtime",
              description: "Import plugin with a runtime tab",
              version: "0.1.0",
              type: "extension",
              category: "import",
              icon: "Puzzle",
              author: "MindStore",
              ui: {
                importTab: {
                  label: "Runtime Importer",
                  icon: "Puzzle",
                  acceptedFileTypes: [".zip"],
                },
                pages: [{ path: "runtime-import", title: "Runtime Import", icon: "Puzzle" }],
              },
              routes: [
                {
                  method: "POST",
                  path: "/api/v1/plugins/runtime-import",
                },
              ],
            },
          }),
          definePlugin({
            manifest: {
              slug: "disabled-import",
              name: "Disabled Import",
              description: "Should not appear while disabled",
              version: "0.1.0",
              type: "extension",
              category: "import",
              icon: "Puzzle",
              author: "MindStore",
              ui: {
                importTab: {
                  label: "Disabled",
                  icon: "Puzzle",
                },
              },
            },
          }),
        ],
      })
    );

    const imports = runtime.getImportTabs(
      new Map([
        ["import-runtime", { status: "active", config: {} }],
        ["disabled-import", { status: "disabled", config: {} }],
      ])
    );

    expect(imports).toEqual([
      {
        pluginSlug: "import-runtime",
        definition: {
          label: "Runtime Importer",
          icon: "Puzzle",
          acceptedFileTypes: [".zip"],
        },
        pluginConfig: {},
        openPath: "/app/runtime-import",
        routePath: "/api/v1/plugins/runtime-import",
        source: "builtin",
      },
    ]);
  });

  it("applies import hook transforms in sequence", async () => {
    const runtime = createPluginRuntime(
      defineMindStoreConfig({
        plugins: [
          definePlugin({
            manifest: {
              slug: "append-import",
              name: "Append Import",
              description: "Appends documents during import",
              version: "0.1.0",
              type: "extension",
              category: "import",
              icon: "Puzzle",
              author: "MindStore",
            },
            hooks: {
              onImport() {
                return {
                  modified: true,
                  data: {
                    appendDocuments: [
                      {
                        title: "Appended",
                        content: "Second document",
                        sourceType: "plugin",
                      },
                    ],
                    metadataPatch: {
                      pluginTagged: true,
                    },
                  },
                };
              },
            },
          }),
        ],
      })
    );

    const result = await applyDocumentHookTransforms({
      runtime,
      hookName: "onImport",
      installedPlugins: new Map([["append-import", { status: "active", config: {} }]]),
      userId: "test-user",
      documents: [
        {
          title: "Original",
          content: "First document",
          sourceType: "text",
        },
      ],
      event: {
        surface: "unit-test",
      },
    });

    expect(result.hooksTriggered).toBe(1);
    expect(result.transformsApplied).toBe(2);
    expect(result.documents).toEqual([
      {
        title: "Original",
        content: "First document",
        sourceType: "text",
        metadata: {
          pluginTagged: true,
        },
        contentType: "text",
      },
      {
        title: "Appended",
        content: "Second document",
        sourceType: "plugin",
        metadata: {
          pluginTagged: true,
        },
        contentType: "text",
      },
    ]);
  });
});
