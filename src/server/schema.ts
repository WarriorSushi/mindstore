import { pgTable, uuid, text, real, integer, timestamp, jsonb, index, uniqueIndex, pgEnum, customType } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Custom vector type for pgvector — no fixed dimension so any provider (OpenAI 1536, Gemini 768, Ollama 768) works
const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return 'vector';
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`;
  },
  fromDriver(value: string): number[] {
    return JSON.parse(value);
  },
});

// Enums
export const contentTypeEnum = pgEnum('content_type', [
  'text', 'image', 'audio', 'video', 'code', 'conversation', 'webpage', 'document',
]);

// === CORE TABLES ===

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').unique(),
  name: text('name'),
  image: text('image'),
  settings: jsonb('settings').default({}),
  createdAt: timestamp('created_at').defaultNow(),
});

export const memories = pgTable('memories', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  content: text('content').notNull(),
  embedding: vector('embedding'),
  contentType: contentTypeEnum('content_type').default('text'),
  sourceType: text('source_type').notNull(), // obsidian, notion, chatgpt, claude, text, url, image, audio
  sourceId: text('source_id'),
  sourceTitle: text('source_title'),
  metadata: jsonb('metadata').default({}),
  parentId: uuid('parent_id'), // for hierarchical indexing
  treePath: text('tree_path'), // materialized path: root/section/subsection
  createdAt: timestamp('created_at').defaultNow(),
  importedAt: timestamp('imported_at').defaultNow(),
}, (table) => [
  index('idx_memories_user').on(table.userId),
  index('idx_memories_source').on(table.userId, table.sourceType),
  index('idx_memories_tree').on(table.userId, table.treePath),
  index('idx_memories_created').on(table.userId, table.createdAt),
]);

// Tree index for hierarchical retrieval (PageIndex-inspired)
export const treeIndex = pgTable('tree_index', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  title: text('title').notNull(),
  summary: text('summary'),
  level: integer('level').default(0), // 0=root, 1=category, 2=topic, 3=subtopic
  parentId: uuid('parent_id'),
  memoryIds: uuid('memory_ids').array(),
  embedding: vector('embedding'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index('idx_tree_user').on(table.userId),
  index('idx_tree_parent').on(table.parentId),
]);

export const profile = pgTable('profile', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  key: text('key').notNull(),
  value: text('value').notNull(),
  category: text('category').default('general'),
  confidence: real('confidence').default(0.5),
  source: text('source').default('manual'),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  uniqueIndex('idx_profile_user_key').on(table.userId, table.key),
]);

export const facts = pgTable('facts', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  fact: text('fact').notNull(),
  category: text('category'),
  entities: text('entities').array(), // extracted named entities
  learnedAt: timestamp('learned_at').defaultNow(),
  source: text('source').default('conversation'),
}, (table) => [
  index('idx_facts_user').on(table.userId),
]);

// Cross-pollination cache
export const connections = pgTable('connections', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  memoryAId: uuid('memory_a_id').references(() => memories.id),
  memoryBId: uuid('memory_b_id').references(() => memories.id),
  similarity: real('similarity'),
  surprise: real('surprise'),
  bridgeConcept: text('bridge_concept'),
  discoveredAt: timestamp('discovered_at').defaultNow(),
});

export const contradictions = pgTable('contradictions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  memoryAId: uuid('memory_a_id').references(() => memories.id),
  memoryBId: uuid('memory_b_id').references(() => memories.id),
  topic: text('topic'),
  description: text('description'),
  detectedAt: timestamp('detected_at').defaultNow(),
});

// Media storage metadata
export const media = pgTable('media', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  memoryId: uuid('memory_id').references(() => memories.id),
  fileType: text('file_type').notNull(), // image/png, audio/mp3, etc.
  filePath: text('file_path').notNull(),
  fileSize: integer('file_size'),
  metadata: jsonb('metadata').default({}), // EXIF, dimensions, duration
  transcript: text('transcript'), // for audio/video
  createdAt: timestamp('created_at').defaultNow(),
});

// OAuth accounts (NextAuth)
export const accounts = pgTable('accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  type: text('type').notNull(),
  provider: text('provider').notNull(),
  providerAccountId: text('provider_account_id').notNull(),
  refreshToken: text('refresh_token'),
  accessToken: text('access_token'),
  expiresAt: integer('expires_at'),
  tokenType: text('token_type'),
  scope: text('scope'),
  idToken: text('id_token'),
});

// Sessions (NextAuth)
export const sessions = pgTable('sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  sessionToken: text('session_token').unique().notNull(),
  expires: timestamp('expires').notNull(),
});

// App settings (API keys, config)
export const settings = pgTable('settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  key: text('key').unique().notNull(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// === PLUGIN SYSTEM ===

export const pluginTypeEnum = pgEnum('plugin_type', ['extension', 'mcp', 'prompt']);
export const pluginStatusEnum = pgEnum('plugin_status', ['installed', 'active', 'disabled', 'error']);

export const plugins = pgTable('plugins', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: text('slug').unique().notNull(), // unique identifier e.g. 'kindle-importer'
  name: text('name').notNull(),
  description: text('description'),
  version: text('version').default('1.0.0'),
  type: pluginTypeEnum('type').notNull().default('extension'),
  status: pluginStatusEnum('status').notNull().default('installed'),
  icon: text('icon'), // lucide icon name
  category: text('category'), // 'import', 'analysis', 'action', 'export', 'ai'
  author: text('author').default('MindStore'),
  config: jsonb('config').default({}), // plugin-specific settings
  metadata: jsonb('metadata').default({}), // capabilities, hooks, routes info
  installedAt: timestamp('installed_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  lastError: text('last_error'),
}, (table) => [
  index('idx_plugins_slug').on(table.slug),
  index('idx_plugins_status').on(table.status),
  index('idx_plugins_category').on(table.category),
]);

// API Keys (for MCP server auth)
export const apiKeys = pgTable('api_keys', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  key: text('key').unique().notNull(),
  name: text('name'),
  lastUsedAt: timestamp('last_used_at'),
  createdAt: timestamp('created_at').defaultNow(),
});
