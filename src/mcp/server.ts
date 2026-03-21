/**
 * MindStore MCP Server
 * Exposes your personal mind as an MCP server that any AI client can connect to
 * Works with Claude Desktop, ChatGPT, VS Code Copilot, Cursor, etc.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { getDb, getProfile, getStats, setProfile } from '../lib/db';
import { searchMind, assembleContext } from '../lib/search';

export function createMindStoreMCPServer() {
  const server = new McpServer({
    name: 'mindstore',
    version: '1.0.0',
  });

  // Tool: Search the mind
  server.tool(
    'search_mind',
    'Search across all stored knowledge, notes, conversations, and memories',
    {
      query: z.string().describe('What to search for'),
      limit: z.number().optional().default(10).describe('Max results to return'),
      source_types: z.array(z.string()).optional().describe('Filter by source type: obsidian, notion, chatgpt, claude, text, manual'),
    },
    async ({ query, limit, source_types }) => {
      const results = await searchMind(query, {
        limit: limit || 10,
        sourceTypes: source_types,
      });

      const formatted = results.map((r, i) => 
        `[${i + 1}] (${r.sourceType || 'unknown'}) ${r.title || 'Untitled'} [score: ${r.score.toFixed(3)}]\n${r.content}`
      ).join('\n\n---\n\n');

      return {
        content: [{ type: 'text' as const, text: formatted || 'No results found.' }],
      };
    }
  );

  // Tool: Get assembled context for a query
  server.tool(
    'get_context',
    'Get assembled context from the user\'s mind relevant to a query. Use this to understand the user better.',
    {
      query: z.string().describe('The topic or question to get context for'),
      max_tokens: z.number().optional().default(4000).describe('Maximum tokens of context to assemble'),
    },
    async ({ query, max_tokens }) => {
      const context = await assembleContext(query, max_tokens || 4000);
      return {
        content: [{ type: 'text' as const, text: context }],
      };
    }
  );

  // Tool: Get user profile
  server.tool(
    'get_profile',
    'Get the user\'s profile — their preferences, traits, goals, knowledge areas, and relationships',
    {},
    async () => {
      const profile = getProfile();
      const formatted = Object.entries(profile)
        .map(([key, val]) => `${key}: ${val.value} (${val.category}, confidence: ${val.confidence})`)
        .join('\n');
      
      return {
        content: [{ type: 'text' as const, text: formatted || 'No profile data yet. The user hasn\'t taught MindStore about themselves.' }],
      };
    }
  );

  // Tool: Learn a new fact about the user
  server.tool(
    'learn_fact',
    'Store a new fact or preference about the user in their MindStore profile',
    {
      key: z.string().describe('The fact key (e.g., "favorite_language", "works_at", "prefers_dark_mode")'),
      value: z.string().describe('The fact value'),
      category: z.enum(['preference', 'trait', 'goal', 'knowledge', 'relationship', 'habit']).describe('Category of this fact'),
      confidence: z.number().optional().default(0.8).describe('Confidence level 0-1'),
    },
    async ({ key, value, category, confidence }) => {
      setProfile(key, value, category, confidence || 0.8, 'learned');
      return {
        content: [{ type: 'text' as const, text: `Learned: ${key} = ${value} (${category})` }],
      };
    }
  );

  // Tool: Get mind statistics
  server.tool(
    'get_mind_stats',
    'Get statistics about what\'s stored in the user\'s MindStore',
    {},
    async () => {
      const stats = getStats();
      const text = [
        `Documents: ${stats.documents}`,
        `Knowledge Chunks: ${stats.chunks}`,
        `Facts: ${stats.facts}`,
        `Profile Items: ${stats.profileItems}`,
        `Conversations: ${stats.conversations}`,
        `Sources: ${stats.sources.map(s => `${s.source_type}: ${s.count}`).join(', ')}`,
      ].join('\n');
      
      return {
        content: [{ type: 'text' as const, text }],
      };
    }
  );

  // Tool: Get recent timeline
  server.tool(
    'get_timeline',
    'Get recent knowledge entries sorted by time — see what the user has been thinking about lately',
    {
      days: z.number().optional().default(7).describe('How many days back to look'),
      limit: z.number().optional().default(20).describe('Max entries'),
    },
    async ({ days, limit }) => {
      const db = getDb();
      const since = new Date(Date.now() - (days || 7) * 86400000).toISOString();
      
      const docs = db.prepare(`
        SELECT title, source_type, created_at, substr(content, 1, 200) as preview
        FROM documents
        WHERE created_at >= ?
        ORDER BY created_at DESC
        LIMIT ?
      `).all(since, limit || 20) as Array<{
        title: string; source_type: string; created_at: string; preview: string;
      }>;

      const formatted = docs.map(d => 
        `[${d.created_at}] (${d.source_type}) ${d.title}\n${d.preview}...`
      ).join('\n\n');

      return {
        content: [{ type: 'text' as const, text: formatted || 'No recent entries in the timeline.' }],
      };
    }
  );

  // Resource: Profile summary
  server.resource(
    'profile://summary',
    'profile://summary',
    async (uri) => {
      const profile = getProfile();
      const stats = getStats();
      
      const summary = [
        '# MindStore Profile Summary',
        '',
        `Total Documents: ${stats.documents}`,
        `Knowledge Chunks: ${stats.chunks}`,
        `Known Facts: ${stats.facts}`,
        '',
        '## Profile',
        ...Object.entries(profile).map(([k, v]) => `- **${k}**: ${v.value}`),
      ].join('\n');

      return {
        contents: [{
          uri: uri.href,
          mimeType: 'text/markdown',
          text: summary,
        }],
      };
    }
  );

  // Prompt: Introduce the user to an AI
  server.prompt(
    'introduce_user',
    'Generate an introduction of the user based on their MindStore profile',
    {},
    async () => {
      const profile = getProfile();
      const stats = getStats();
      
      const profileText = Object.entries(profile)
        .map(([k, v]) => `- ${k}: ${v.value}`)
        .join('\n');

      return {
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: `Based on this person's MindStore profile, introduce them:\n\nProfile:\n${profileText}\n\nMind Stats: ${stats.documents} documents, ${stats.chunks} knowledge chunks, ${stats.facts} facts stored.\n\nPlease provide a natural introduction of this person that would help an AI understand who they are.`,
          },
        }],
      };
    }
  );

  // Prompt: Provide context for a query
  server.prompt(
    'provide_context',
    'Assemble relevant context from MindStore for a given query',
    {
      query: z.string().describe('The query to provide context for'),
    },
    async ({ query }) => {
      const context = await assembleContext(query as string, 4000);
      
      return {
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: `Here is relevant context from the user's MindStore for the query "${query}":\n\n${context}\n\nUse this context to provide a more personalized and informed response.`,
          },
        }],
      };
    }
  );

  return server;
}

/**
 * Start the MCP server on stdio
 * This is what gets executed when the user adds MindStore to their MCP config
 */
export async function startMCPServer() {
  const server = createMindStoreMCPServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('MindStore MCP server started');
}

// Run if called directly
if (require.main === module) {
  startMCPServer().catch(console.error);
}
