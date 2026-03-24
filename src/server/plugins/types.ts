/**
 * MindStore Plugin System — Type Definitions
 * 
 * Three tiers:
 * 1. Extension — Full code plugins with API routes, UI components, DB access
 * 2. MCP — Expose new MCP tools that work with MindStore data
 * 3. Prompt — JSON manifest + system prompt + config (config-only)
 */

// ─── Plugin Manifest ────────────────────────────────────────────

export type PluginType = 'extension' | 'mcp' | 'prompt';
export type PluginStatus = 'installed' | 'active' | 'disabled' | 'error';
export type PluginCategory = 'import' | 'analysis' | 'action' | 'export' | 'ai';

export interface PluginManifest {
  slug: string;             // unique identifier: 'kindle-importer'
  name: string;             // display name: 'Kindle Highlights Importer'
  description: string;      // one-liner for store card
  longDescription?: string; // detailed description for detail view
  version: string;          // semver: '1.0.0'
  type: PluginType;
  category: PluginCategory;
  icon: string;             // lucide icon name: 'BookOpen'
  author: string;
  
  // Capabilities & requirements
  capabilities?: PluginCapability[];
  hooks?: PluginHookName[];
  
  // UI configuration
  ui?: {
    settingsSchema?: PluginSettingField[];  // dynamic settings form
    pages?: PluginPage[];                    // new pages this plugin adds
    dashboardWidgets?: PluginWidget[];       // dashboard widget slots
    importTab?: {                            // adds a tab to Import page
      label: string;
      icon: string;
      acceptedFileTypes?: string[];          // e.g. ['.txt', '.json']
    };
  };
  
  // API routes this plugin registers
  routes?: PluginRoute[];
  
  // MCP tool definitions (for type: 'mcp')
  mcpTools?: MCPToolDefinition[];
  
  // Prompt configuration (for type: 'prompt')
  promptConfig?: {
    systemPrompt: string;
    temperature?: number;
    maxTokens?: number;
  };
}

// ─── Plugin Capabilities ─────────────────────────────────────────

export type PluginCapability =
  | 'read:memories'       // can read memories
  | 'write:memories'      // can create/update memories
  | 'delete:memories'     // can delete memories
  | 'read:profile'        // can read user profile/facts
  | 'write:profile'       // can write to user profile
  | 'read:embeddings'     // can use embedding search
  | 'write:embeddings'    // can generate embeddings
  | 'chat:generate'       // can call AI chat
  | 'files:read'          // can read uploaded files
  | 'files:write'         // can write files (exports)
  | 'network:fetch'       // can make external HTTP requests
  | 'background:jobs'     // can schedule background tasks
  | 'ui:pages'            // can add new pages
  | 'ui:widgets'          // can add dashboard widgets
  | 'ui:import-tab';      // can add import tab

// ─── Plugin Hooks ────────────────────────────────────────────────

export type PluginHookName =
  | 'onInstall'           // called when plugin is first installed
  | 'onUninstall'         // called when plugin is removed
  | 'onEnable'            // called when plugin is enabled
  | 'onDisable'           // called when plugin is disabled
  | 'onImport'            // called after a memory is imported
  | 'onSearch'            // called after search results are returned
  | 'onChat'              // called before/after chat response
  | 'onDashboard'         // called when dashboard renders
  | 'onExplore'           // called when explore page renders
  | 'onMemoryCreate'      // called when a new memory is created
  | 'onMemoryUpdate'      // called when a memory is updated
  | 'onMemoryDelete';     // called when a memory is deleted

export interface PluginHookContext {
  pluginSlug: string;
  pluginConfig: Record<string, unknown>;
  userId: string;
}

export interface PluginHookResult {
  modified?: boolean;
  data?: unknown;
  error?: string;
}

// ─── Plugin Settings Schema ──────────────────────────────────────

export interface PluginSettingField {
  key: string;
  label: string;
  description?: string;
  type: 'text' | 'number' | 'boolean' | 'select' | 'textarea' | 'password' | 'file';
  default?: string | number | boolean;
  required?: boolean;
  placeholder?: string;
  options?: { label: string; value: string }[];   // for type: 'select'
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    message?: string;
  };
}

// ─── Plugin Pages & Widgets ──────────────────────────────────────

export interface PluginPage {
  path: string;            // route path relative to /app/plugins/[slug]/
  title: string;
  icon: string;            // lucide icon name
  showInSidebar?: boolean; // whether to add to the main nav
}

export interface PluginWidget {
  id: string;
  title: string;
  size: 'small' | 'medium' | 'large'; // grid span
  priority: number;        // render order (lower = first)
}

// ─── Plugin Routes ───────────────────────────────────────────────

export interface PluginRoute {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;            // relative to /api/v1/plugins/[slug]/
  description?: string;
}

// ─── MCP Tool Definition ─────────────────────────────────────────

export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description?: string;
      enum?: string[];
    }>;
    required?: string[];
  };
}

// ─── Plugin Store Types ──────────────────────────────────────────

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
}

// ─── Plugin DB Record ────────────────────────────────────────────

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
