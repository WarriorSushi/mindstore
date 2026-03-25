import { definePlugin } from "@mindstore/plugin-sdk";

const communityHelloPlugin = definePlugin({
  source: "external",
  manifest: {
    slug: "community-hello",
    name: "Community Hello",
    description: "A sample external plugin that proves MindStore can load community MCP tools without core app edits.",
    version: "0.1.0",
    type: "mcp",
    category: "action",
    icon: "Sparkles",
    author: "MindStore Community",
    capabilities: ["read:profile", "ui:widgets", "background:jobs"],
    hooks: ["onInstall", "onEnable"],
    ui: {
      settingsSchema: [
        {
          key: "greetingPrefix",
          label: "Greeting Prefix",
          description: "Prefix used when the sample MCP tool responds.",
          type: "text",
          default: "Hello",
          placeholder: "Hello",
        },
      ],
      dashboardWidgets: [
        {
          id: "community-hello-widget",
          title: "Community Plugin Health",
          description: "A sample widget rendered from an external plugin package.",
          size: "small",
          priority: 10,
          cta: {
            label: "Open Plugins",
            href: "/app/plugins",
          },
        },
      ],
    },
    jobs: [
      {
        id: "community-hello-refresh",
        name: "Refresh Greeting Snapshot",
        description: "Generate a fresh summary showing the current sample plugin configuration.",
        trigger: "manual",
      },
    ],
  },
  hooks: {
    async onInstall() {
      return { modified: false, data: { installed: true } };
    },
  },
  dashboard: {
    widgets: [
      {
        id: "community-hello-widget",
        load(context) {
          const prefix =
            typeof context.pluginConfig.greetingPrefix === "string"
              ? context.pluginConfig.greetingPrefix
              : "Hello";
          return {
            summary: "External plugins can contribute dashboard UI without editing the core app.",
            metrics: [
              { label: "Greeting", value: prefix, tone: "positive" },
              { label: "Surface", value: "Dashboard" },
            ],
            items: [
              { label: "Plugin", value: "Community Hello" },
              { label: "User", value: context.userId.slice(0, 8) },
            ],
            updatedAt: new Date().toISOString(),
          };
        },
      },
    ],
  },
  jobs: [
    {
      id: "community-hello-refresh",
      run(context) {
        const prefix =
          typeof context.pluginConfig.greetingPrefix === "string"
            ? context.pluginConfig.greetingPrefix
            : "Hello";
        return {
          status: "success",
          summary: `${prefix} from the external plugin runtime.`,
          details: [
            "Manual job execution works for community plugins.",
            "Job runs are persisted on the plugin record for later inspection.",
          ],
          metadata: {
            greetingPrefix: prefix,
            reason: context.reason ?? "manual",
          },
        };
      },
    },
  ],
  mcp: {
    tools: [
      {
        definition: {
          name: "community_hello",
          description: "Respond with a greeting from the example community plugin.",
          inputSchema: {
            type: "object",
            properties: {
              name: { type: "string", description: "The name to greet." },
            },
            required: ["name"],
          },
        },
        handler(args, context) {
          const prefix =
            typeof context.pluginConfig.greetingPrefix === "string"
              ? context.pluginConfig.greetingPrefix
              : "Hello";
          const target = typeof args.name === "string" && args.name.trim() ? args.name.trim() : "friend";
          return {
            text: `${prefix}, ${target}. This response came from the external community plugin runtime.`,
          };
        },
      },
    ],
    resources: [
      {
        uri: "mindstore://community-hello/about",
        name: "Community Hello",
        description: "Explains what the example community plugin demonstrates.",
        mimeType: "text/plain",
        read() {
          return "This example plugin demonstrates external MCP tools and resources loaded from mindstore.config.ts.";
        },
      },
    ],
  },
});

export default communityHelloPlugin;
