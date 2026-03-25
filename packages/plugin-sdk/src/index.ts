export type PluginType = "extension" | "mcp" | "prompt";
export type PluginStatus = "installed" | "active" | "disabled" | "error";
export type PluginCategory = "import" | "analysis" | "action" | "export" | "ai";
export type DeploymentMode = "self-hosted" | "self-hosted-team" | "hosted-ready";
export type CaptureMode = "auto" | "smart" | "selection" | "page" | "conversation";
export type CaptureSourceApp = "web" | "chatgpt" | "claude" | "openclaw" | "unknown";

export interface PluginManifest {
  slug: string;
  aliases?: string[];
  name: string;
  description: string;
  longDescription?: string;
  version: string;
  type: PluginType;
  category: PluginCategory;
  icon: string;
  author: string;
  capabilities?: PluginCapability[];
  hooks?: PluginHookName[];
  ui?: {
    settingsSchema?: PluginSettingField[];
    pages?: PluginPage[];
    dashboardWidgets?: PluginWidget[];
    importTab?: {
      label: string;
      icon: string;
      acceptedFileTypes?: string[];
    };
  };
  routes?: PluginRoute[];
  mcpTools?: MCPToolDefinition[];
  promptConfig?: {
    systemPrompt: string;
    temperature?: number;
    maxTokens?: number;
  };
}

export type PluginCapability =
  | "read:memories"
  | "write:memories"
  | "delete:memories"
  | "read:profile"
  | "write:profile"
  | "read:embeddings"
  | "write:embeddings"
  | "chat:generate"
  | "files:read"
  | "files:write"
  | "network:fetch"
  | "background:jobs"
  | "ui:pages"
  | "ui:widgets"
  | "ui:import-tab";

export type PluginHookName =
  | "onInstall"
  | "onUninstall"
  | "onEnable"
  | "onDisable"
  | "onCapture"
  | "onImport"
  | "onSearch"
  | "onChat"
  | "onDashboard"
  | "onExplore"
  | "onMemoryCreate"
  | "onMemoryUpdate"
  | "onMemoryDelete";

export interface PluginHookContext {
  pluginSlug: string;
  pluginConfig: Record<string, unknown>;
  userId?: string;
  event?: unknown;
  metadata?: Record<string, unknown>;
}

export interface PluginHookResult {
  modified?: boolean;
  data?: unknown;
  error?: string;
}

export interface PluginSettingField {
  key: string;
  label: string;
  description?: string;
  type: "text" | "number" | "boolean" | "select" | "textarea" | "password" | "file";
  default?: string | number | boolean;
  required?: boolean;
  placeholder?: string;
  options?: { label: string; value: string }[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    message?: string;
  };
}

export interface PluginPage {
  path: string;
  title: string;
  icon: string;
  showInSidebar?: boolean;
}

export interface PluginWidget {
  id: string;
  title: string;
  size: "small" | "medium" | "large";
  priority: number;
}

export interface PluginRoute {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  description?: string;
}

export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<
      string,
      {
        type: string;
        description?: string;
        enum?: string[];
      }
    >;
    required?: string[];
  };
}

export interface PluginStoreEntry {
  slug: string;
  name: string;
  description: string;
  longDescription?: string;
  version: string;
  type: PluginType;
  category: PluginCategory;
  icon: string;
  author: string;
  capabilities?: PluginCapability[];
  installed: boolean;
  status?: PluginStatus;
  featured?: boolean;
  tags?: string[];
  source?: "builtin" | "external";
}

export interface PluginRecord {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  version: string | null;
  type: PluginType;
  status: PluginStatus;
  icon: string | null;
  category: string | null;
  author: string | null;
  config: Record<string, unknown>;
  metadata: Record<string, unknown>;
  installedAt: Date | null;
  updatedAt: Date | null;
  lastError: string | null;
}

export interface PluginMcpToolContext {
  userId: string;
  pluginSlug: string;
  pluginConfig: Record<string, unknown>;
}

export interface PluginMcpToolResult {
  text: string;
}

export interface PluginMcpTool {
  definition: MCPToolDefinition;
  handler: (
    args: Record<string, unknown>,
    context: PluginMcpToolContext
  ) => Promise<PluginMcpToolResult> | PluginMcpToolResult;
}

export interface PluginMcpResourceContext {
  userId: string;
  pluginSlug: string;
  pluginConfig: Record<string, unknown>;
}

export interface PluginMcpResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
  read: (context: PluginMcpResourceContext) => Promise<string> | string;
}

export interface PluginPromptDefinition {
  name: string;
  description: string;
  arguments?: Array<{
    name: string;
    description: string;
    required?: boolean;
  }>;
}

export interface PluginPromptContext {
  userId: string;
  pluginSlug: string;
  pluginConfig: Record<string, unknown>;
}

export interface PluginPromptResult {
  description?: string;
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
}

export interface CapturePayload {
  title?: string;
  url?: string;
  mode?: CaptureMode;
  captureMode?: CaptureMode;
  sourceType?: string;
  sourceApp?: CaptureSourceApp;
  siteName?: string;
  content?: string;
  selection?: string;
  pageText?: string;
  conversationText?: string;
  metadata?: Record<string, unknown>;
}

export interface PluginPrompt {
  definition: PluginPromptDefinition;
  render: (
    args: Record<string, unknown>,
    context: PluginPromptContext
  ) => Promise<PluginPromptResult> | PluginPromptResult;
}

export interface MindStorePluginModule {
  manifest: PluginManifest;
  source?: "builtin" | "external";
  hooks?: Partial<Record<PluginHookName, (context: PluginHookContext) => Promise<PluginHookResult | void> | PluginHookResult | void>>;
  mcp?: {
    tools?: PluginMcpTool[];
    resources?: PluginMcpResource[];
    prompts?: PluginPrompt[];
  };
}

export interface MindStoreConfig {
  docsRoot?: string;
  deploymentMode?: DeploymentMode;
  plugins: MindStorePluginModule[];
}

export function definePlugin<T extends MindStorePluginModule>(plugin: T): T {
  return plugin;
}

export function defineMindStoreConfig<T extends MindStoreConfig>(config: T): T {
  return config;
}
