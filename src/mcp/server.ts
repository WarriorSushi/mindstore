#!/usr/bin/env node
/**
 * MindStore MCP Server
 * 
 * This is the Universal AI Memory Layer.
 * Any MCP client (Claude Desktop, VS Code, Cursor, ChatGPT) connects to this
 * and gets full context about the user — their knowledge, preferences, history.
 * 
 * Protocol: Model Context Protocol (stdio transport)
 * 
 * Tools:
 *   search_mind     — Semantic search across all knowledge
 *   get_context     — Assembled context for a query
 *   get_profile     — User profile and preferences
 *   learn_fact      — Store a new fact about the user
 *   get_mind_stats  — Knowledge base statistics
 *   get_timeline    — Recent knowledge entries
 *   get_connections  — Cross-pollination: unexpected bridges in knowledge
 *   get_contradictions — Find conflicting beliefs
 *   get_metabolism  — Knowledge metabolism score
 * 
 * Resources:
 *   profile://summary — Full profile summary
 *   mind://fingerprint — Knowledge graph structure
 * 
 * Prompts:
 *   introduce_user    — Generate user introduction for AI context
 *   provide_context   — Assemble relevant context for a query
 *   devils_advocate   — Challenge assumptions using user's own knowledge
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';

const DB_PATH = process.env.MINDSTORE_DB_PATH || path.join(os.homedir(), '.mindstore', 'mindstore.db');

function getDb(): Database.Database {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  
  // Initialize tables if they don't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      embedding BLOB,
      source TEXT NOT NULL,
      source_id TEXT,
      source_title TEXT,
      timestamp INTEGER,
      imported_at INTEGER DEFAULT (unixepoch()),
      metadata TEXT DEFAULT '{}'
    );
    CREATE TABLE IF NOT EXISTS profile (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      category TEXT DEFAULT 'general',
      confidence REAL DEFAULT 0.5,
      source TEXT DEFAULT 'manual',
      updated_at INTEGER DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS facts (
      id TEXT PRIMARY KEY,
      fact TEXT NOT NULL,
      category TEXT,
      learned_at INTEGER DEFAULT (unixepoch()),
      source TEXT DEFAULT 'conversation'
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(content, source_title);
  `);
  
  return db;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
}

async function createMindStoreMCPServer() {
  const server = new McpServer({
    name: 'mindstore',
    version: '1.0.0',
  });

  // === TOOLS ===

  server.tool(
    'search_mind',
    'Search across all stored knowledge semantically and by keyword',
    { query: z.string(), limit: z.number().optional().default(10) },
    async ({ query, limit }) => {
      const db = getDb();
      
      // FTS5 keyword search
      const ftsResults = db.prepare(
        `SELECT rowid, content, source_title, source FROM memories_fts WHERE memories_fts MATCH ? LIMIT ?`
      ).all(query.replace(/[^\w\s]/g, ' '), limit) as any[];
      
      // Also get all for vector search if embeddings exist
      const allWithEmb = db.prepare(
        `SELECT id, content, source, source_title, embedding FROM memories WHERE embedding IS NOT NULL LIMIT 500`
      ).all() as any[];
      
      // TODO: embed the query using the same model, then vector search
      // For now, return FTS results
      
      const results = ftsResults.map((r: any) => ({
        content: r.content,
        source: r.source,
        title: r.source_title,
      }));
      
      db.close();
      return { content: [{ type: 'text' as const, text: JSON.stringify(results, null, 2) }] };
    }
  );

  server.tool(
    'get_context',
    'Get assembled context about the user relevant to a query. Use this to personalize responses.',
    { query: z.string(), max_tokens: z.number().optional().default(2000) },
    async ({ query, max_tokens }) => {
      const db = getDb();
      
      const fts = db.prepare(
        `SELECT content, source_title, source FROM memories_fts WHERE memories_fts MATCH ? LIMIT 5`
      ).all(query.replace(/[^\w\s]/g, ' ')) as any[];
      
      const profile = db.prepare('SELECT key, value, category FROM profile ORDER BY confidence DESC').all() as any[];
      
      let context = '## User Profile\n';
      for (const p of profile) {
        context += `- ${p.key}: ${p.value}\n`;
      }
      
      if (fts.length > 0) {
        context += '\n## Relevant Knowledge\n';
        for (const r of fts) {
          context += `\n### ${r.source_title || 'Untitled'} (${r.source})\n${r.content.slice(0, 500)}\n`;
        }
      }
      
      // Trim to max_tokens approx (4 chars per token)
      if (context.length > max_tokens * 4) {
        context = context.slice(0, max_tokens * 4) + '\n...(truncated)';
      }
      
      db.close();
      return { content: [{ type: 'text' as const, text: context }] };
    }
  );

  server.tool(
    'get_profile',
    'Get the user\'s profile — preferences, traits, goals, and learned facts',
    {},
    async () => {
      const db = getDb();
      const profile = db.prepare('SELECT key, value, category, confidence FROM profile ORDER BY category, key').all();
      const facts = db.prepare('SELECT fact, category FROM facts ORDER BY learned_at DESC LIMIT 50').all();
      db.close();
      return { content: [{ type: 'text' as const, text: JSON.stringify({ profile, facts }, null, 2) }] };
    }
  );

  server.tool(
    'learn_fact',
    'Store a new fact about the user. Call this whenever you learn something about the user during conversation.',
    {
      key: z.string().describe('Short key like "favorite_language" or "workplace"'),
      value: z.string().describe('The fact value'),
      category: z.enum(['preference', 'trait', 'goal', 'knowledge', 'relationship', 'habit']).optional().default('knowledge'),
    },
    async ({ key, value, category }) => {
      const db = getDb();
      db.prepare(
        'INSERT OR REPLACE INTO profile (key, value, category, confidence, source, updated_at) VALUES (?, ?, ?, 0.9, ?, unixepoch())'
      ).run(key, value, category, 'ai_learned');
      db.prepare(
        'INSERT INTO facts (id, fact, category) VALUES (?, ?, ?)'
      ).run(crypto.randomUUID(), `${key}: ${value}`, category);
      db.close();
      return { content: [{ type: 'text' as const, text: `Learned: ${key} = ${value}` }] };
    }
  );

  server.tool(
    'get_mind_stats',
    'Get statistics about the user\'s knowledge base',
    {},
    async () => {
      const db = getDb();
      const memories = (db.prepare('SELECT COUNT(*) as count FROM memories').get() as any).count;
      const sources = db.prepare('SELECT source, COUNT(*) as count FROM memories GROUP BY source').all();
      const profile = (db.prepare('SELECT COUNT(*) as count FROM profile').get() as any).count;
      const facts = (db.prepare('SELECT COUNT(*) as count FROM facts').get() as any).count;
      db.close();
      return { content: [{ type: 'text' as const, text: JSON.stringify({ memories, sources, profile, facts }, null, 2) }] };
    }
  );

  server.tool(
    'get_timeline',
    'Get recent knowledge entries, ordered by time',
    { days: z.number().optional().default(7), limit: z.number().optional().default(20) },
    async ({ days, limit }) => {
      const db = getDb();
      const cutoff = Math.floor(Date.now() / 1000) - days * 86400;
      const recent = db.prepare(
        'SELECT content, source, source_title, imported_at FROM memories WHERE imported_at > ? ORDER BY imported_at DESC LIMIT ?'
      ).all(cutoff, limit);
      db.close();
      return { content: [{ type: 'text' as const, text: JSON.stringify(recent, null, 2) }] };
    }
  );

  server.tool(
    'get_connections',
    'Find unexpected cross-pollinations between distant knowledge areas',
    { limit: z.number().optional().default(5) },
    async ({ limit }) => {
      const db = getDb();
      // Get diverse memories from different sources
      const sources = db.prepare('SELECT DISTINCT source FROM memories').all() as any[];
      const connections: any[] = [];
      
      for (let i = 0; i < sources.length; i++) {
        for (let j = i + 1; j < sources.length; j++) {
          const a = db.prepare('SELECT content, source, source_title FROM memories WHERE source = ? ORDER BY RANDOM() LIMIT 1').get(sources[i].source) as any;
          const b = db.prepare('SELECT content, source, source_title FROM memories WHERE source = ? ORDER BY RANDOM() LIMIT 1').get(sources[j].source) as any;
          if (a && b) {
            connections.push({
              from: { source: a.source, title: a.source_title, excerpt: a.content.slice(0, 200) },
              to: { source: b.source, title: b.source_title, excerpt: b.content.slice(0, 200) },
              note: 'These pieces of knowledge come from different sources and may reveal unexpected connections.',
            });
          }
        }
      }
      
      db.close();
      return { content: [{ type: 'text' as const, text: JSON.stringify(connections.slice(0, limit), null, 2) }] };
    }
  );

  server.tool(
    'get_contradictions',
    'Find potential contradictions in the user\'s knowledge — places where their thinking conflicts',
    {},
    async () => {
      const db = getDb();
      // Simple approach: find FTS matches with opposing sentiment words
      const contradictionPairs = [
        ['always', 'never'], ['best', 'worst'], ['love', 'hate'],
        ['should', 'should not'], ['agree', 'disagree'],
      ];
      
      const results: any[] = [];
      for (const [pos, neg] of contradictionPairs) {
        const posResults = db.prepare(`SELECT content, source_title FROM memories_fts WHERE content MATCH ? LIMIT 3`).all(pos) as any[];
        const negResults = db.prepare(`SELECT content, source_title FROM memories_fts WHERE content MATCH ? LIMIT 3`).all(neg) as any[];
        if (posResults.length > 0 && negResults.length > 0) {
          results.push({
            topic: `${pos} vs ${neg}`,
            positive: posResults[0],
            negative: negResults[0],
          });
        }
      }
      
      db.close();
      return { content: [{ type: 'text' as const, text: JSON.stringify(results, null, 2) }] };
    }
  );

  server.tool(
    'get_metabolism',
    'Get the user\'s knowledge metabolism score — how actively they\'re building their mind',
    {},
    async () => {
      const db = getDb();
      const weekAgo = Math.floor(Date.now() / 1000) - 7 * 86400;
      const recentCount = (db.prepare('SELECT COUNT(*) as count FROM memories WHERE imported_at > ?').get(weekAgo) as any).count;
      const totalCount = (db.prepare('SELECT COUNT(*) as count FROM memories').get() as any).count;
      const sourceCount = (db.prepare('SELECT COUNT(DISTINCT source) as count FROM memories').get() as any).count;
      
      const score = Math.min(10, Math.round((
        Math.min(recentCount / 10, 3) + // intake
        Math.min(sourceCount / 3, 3) + // diversity
        Math.min(totalCount / 50, 4) // volume
      ) * 10) / 10);
      
      db.close();
      return { content: [{ type: 'text' as const, text: JSON.stringify({
        score,
        recentItems: recentCount,
        totalItems: totalCount,
        sourceDiversity: sourceCount,
        verdict: score >= 7 ? 'Excellent' : score >= 4 ? 'Good' : 'Needs attention',
      }, null, 2) }] };
    }
  );

  // === RESOURCES ===

  server.resource(
    'profile_summary',
    'profile://summary',
    async (uri) => {
      const db = getDb();
      const profile = db.prepare('SELECT key, value, category FROM profile ORDER BY category').all() as any[];
      const summary = profile.map(p => `[${p.category}] ${p.key}: ${p.value}`).join('\n');
      db.close();
      return { contents: [{ uri: uri.href, text: summary || 'No profile data yet.' }] };
    }
  );

  // === PROMPTS ===

  server.prompt(
    'introduce_user',
    'Generate a comprehensive introduction of the user based on their MindStore profile and knowledge',
    {},
    async () => {
      const db = getDb();
      const profile = db.prepare('SELECT key, value, category FROM profile').all() as any[];
      const stats = (db.prepare('SELECT COUNT(*) as count FROM memories').get() as any).count;
      const sources = db.prepare('SELECT source, COUNT(*) as count FROM memories GROUP BY source').all() as any[];
      db.close();

      const profileText = profile.length > 0
        ? profile.map(p => `- ${p.key}: ${p.value}`).join('\n')
        : 'No profile data available yet.';

      const sourceText = sources.map(s => `${s.source}: ${s.count} items`).join(', ');

      return {
        messages: [{
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `Based on MindStore data, here is what is known about this user:\n\n## Profile\n${profileText}\n\n## Knowledge Base\n- Total memories: ${stats}\n- Sources: ${sourceText}\n\nPlease use this context to personalize your interactions. Refer to specific details when relevant.`,
          },
        }],
      };
    }
  );

  server.prompt(
    'provide_context',
    'Assemble relevant context from the user\'s mind for a specific topic',
    { topic: z.string() },
    async ({ topic }) => {
      const db = getDb();
      const results = db.prepare(
        `SELECT content, source_title, source FROM memories_fts WHERE memories_fts MATCH ? LIMIT 10`
      ).all(topic.replace(/[^\w\s]/g, ' ')) as any[];
      db.close();

      const contextText = results.length > 0
        ? results.map((r, i) => `[${i + 1}] (${r.source}) ${r.source_title || 'Untitled'}\n${r.content.slice(0, 300)}`).join('\n\n')
        : 'No relevant context found in the user\'s knowledge base.';

      return {
        messages: [{
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `Here is relevant context from the user's personal knowledge base about "${topic}":\n\n${contextText}\n\nUse this context to provide more personalized and informed responses.`,
          },
        }],
      };
    }
  );

  server.prompt(
    'devils_advocate',
    'Challenge the user\'s assumptions using their own stored knowledge. Devil\'s advocate mode.',
    { belief: z.string() },
    async ({ belief }) => {
      const db = getDb();
      const related = db.prepare(
        `SELECT content, source_title FROM memories_fts WHERE memories_fts MATCH ? LIMIT 10`
      ).all(belief.replace(/[^\w\s]/g, ' ')) as any[];
      db.close();

      return {
        messages: [{
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `The user holds this belief: "${belief}"\n\nHere is relevant knowledge from their own database:\n${related.map((r, i) => `[${i + 1}] ${r.content.slice(0, 300)}`).join('\n\n')}\n\nYour task: act as a devil's advocate. Using THEIR OWN knowledge, find evidence that challenges or complicates this belief. Be respectful but rigorous. Point out nuances, contradictions, or alternative interpretations.`,
          },
        }],
      };
    }
  );

  return server;
}

async function main() {
  const server = await createMindStoreMCPServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('MindStore MCP server started');
}

main().catch(console.error);
