import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { sql } from 'drizzle-orm';
import { retrieve } from '@/server/retrieval';
import { generateEmbeddings } from '@/server/embeddings';
import { getUserId } from '@/server/user';

/**
 * MindStore MCP Server — Streamable HTTP transport
 * 
 * Implements the Model Context Protocol (MCP) over HTTP.
 * Any MCP-compatible AI client (Claude Desktop, Cursor, OpenClaw, etc.)
 * can search and retrieve knowledge from a user's MindStore.
 * 
 * Supports:
 * - initialize / initialized
 * - tools/list
 * - tools/call (search_mind, get_profile, get_context)
 * - resources/list
 * - resources/read
 */

const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000000';

// MCP tools use the auth user when available, otherwise default
async function getMcpUserId(): Promise<string> {
  try {
    return await getUserId();
  } catch {
    return DEFAULT_USER_ID;
  }
}

const TOOLS = [
  {
    name: 'search_mind',
    description: 'Search your personal knowledge base semantically. Returns relevant memories from your conversations, notes, documents, and more.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Natural language search query' },
        limit: { type: 'number', description: 'Max results (default 5, max 20)' },
        source: { type: 'string', description: 'Filter by source type: chatgpt, text, file, url' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_profile',
    description: 'Get a summary of the user\'s knowledge base: how many memories, what sources, top topics.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_context',
    description: 'Get relevant context for a topic from the user\'s knowledge base. Returns top matching memories formatted for use as context.',
    inputSchema: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: 'Topic to get context about' },
        limit: { type: 'number', description: 'Max memories to include (default 5)' },
      },
      required: ['topic'],
    },
  },
];

const RESOURCES = [
  {
    uri: 'mindstore://profile',
    name: 'Knowledge Profile',
    description: 'Summary statistics about the user\'s stored knowledge',
    mimeType: 'application/json',
  },
  {
    uri: 'mindstore://recent',
    name: 'Recent Memories',
    description: 'The 10 most recently added memories',
    mimeType: 'application/json',
  },
];

// --- Tool implementations ---

async function toolSearchMind(args: { query: string; limit?: number; source?: string }): Promise<string> {
  const limit = Math.min(args.limit || 5, 20);
  const userId = await getMcpUserId();

  // Try to get embedding for semantic search
  let embedding: number[] | null = null;
  try {
    const embeddings = await generateEmbeddings([args.query]);
    if (embeddings && embeddings.length > 0) {
      embedding = embeddings[0];
    }
  } catch { /* fallback to BM25 only */ }

  const results = await retrieve(args.query, embedding, {
    userId,
    limit,
    sourceTypes: args.source ? [args.source] : undefined,
  });

  if (results.length === 0) {
    return `No results found for "${args.query}" in the knowledge base.`;
  }

  const formatted = results.map((r, i) => {
    const date = r.createdAt ? new Date(r.createdAt).toLocaleDateString() : 'unknown date';
    const layers = Object.keys(r.layers).join('+');
    return `[${i + 1}] "${r.sourceTitle || 'Untitled'}" (${r.sourceType}, ${date}) [matched via: ${layers}]\n${r.content}`;
  }).join('\n\n---\n\n');

  return `Found ${results.length} relevant memories:\n\n${formatted}`;
}

async function toolGetProfile(): Promise<string> {
  const userId = await getMcpUserId();

  const stats = await db.execute(sql`
    SELECT 
      COUNT(*) as total,
      COUNT(DISTINCT source_type) as source_types,
      COUNT(DISTINCT source_title) as sources,
      MIN(created_at) as earliest,
      MAX(created_at) as latest
    FROM memories WHERE user_id = ${userId}::uuid
  `);

  const byType = await db.execute(sql`
    SELECT source_type, COUNT(*) as count 
    FROM memories WHERE user_id = ${userId}::uuid 
    GROUP BY source_type ORDER BY count DESC
  `);

  const topSources = await db.execute(sql`
    SELECT source_title, source_type, COUNT(*) as count
    FROM memories WHERE user_id = ${userId}::uuid
    GROUP BY source_title, source_type
    ORDER BY count DESC LIMIT 10
  `);

  const row = (stats as any[])[0] || {};
  const total = parseInt(row.total) || 0;

  if (total === 0) {
    return 'The knowledge base is empty. No memories have been imported yet.';
  }

  const typeBreakdown = (byType as any[])
    .map(r => `  - ${r.source_type}: ${r.count} memories`)
    .join('\n');

  const topSourcesList = (topSources as any[])
    .map(r => `  - "${r.source_title || 'Untitled'}" (${r.source_type}): ${r.count} chunks`)
    .join('\n');

  const earliest = row.earliest ? new Date(row.earliest).toLocaleDateString() : 'N/A';
  const latest = row.latest ? new Date(row.latest).toLocaleDateString() : 'N/A';

  return `Knowledge Base Profile:
- Total memories: ${total}
- Distinct sources: ${row.sources || 0}
- Date range: ${earliest} to ${latest}

By type:
${typeBreakdown}

Top sources:
${topSourcesList}`;
}

async function toolGetContext(args: { topic: string; limit?: number }): Promise<string> {
  // Reuse search_mind but format differently for context injection
  const result = await toolSearchMind({ query: args.topic, limit: args.limit || 5 });
  return `Context from the user's knowledge base about "${args.topic}":\n\n${result}`;
}

// --- Resource implementations ---

async function resourceProfile(): Promise<string> {
  return await toolGetProfile();
}

async function resourceRecent(): Promise<string> {
  const userId = await getMcpUserId();

  const recent = await db.execute(sql`
    SELECT id, content, source_type, source_title, created_at
    FROM memories WHERE user_id = ${userId}::uuid
    ORDER BY created_at DESC LIMIT 10
  `);

  if (!(recent as any[]).length) {
    return 'No memories yet.';
  }

  const formatted = (recent as any[]).map((r, i) => {
    const date = r.created_at ? new Date(r.created_at).toLocaleDateString() : 'unknown';
    return `[${i + 1}] "${r.source_title || 'Untitled'}" (${r.source_type}, ${date})\n${r.content.slice(0, 300)}${r.content.length > 300 ? '...' : ''}`;
  }).join('\n\n---\n\n');

  return `10 most recent memories:\n\n${formatted}`;
}

// --- MCP Protocol Handler ---

function jsonRpcResponse(id: unknown, result: unknown) {
  return { jsonrpc: '2.0' as const, id, result };
}

function jsonRpcError(id: unknown, code: number, message: string) {
  return { jsonrpc: '2.0' as const, id, error: { code, message } };
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function GET() {
  // Discovery endpoint — return server info
  return NextResponse.json({
    name: 'mindstore',
    version: '0.2.0',
    description: 'Your personal MindStore — searchable knowledge from your conversations, notes, and documents',
    capabilities: { tools: TOOLS, resources: RESOURCES },
    status: 'active',
  }, { headers: CORS_HEADERS });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { method, params, id } = body;

    let response;

    switch (method) {
      case 'initialize':
        response = jsonRpcResponse(id, {
          protocolVersion: '2024-11-05',
          serverInfo: { name: 'mindstore', version: '0.2.0' },
          capabilities: {
            tools: { listChanged: false },
            resources: { subscribe: false, listChanged: false },
          },
        });
        break;

      case 'notifications/initialized':
        // Client acknowledges initialization — no response needed for notifications
        return new NextResponse(null, { status: 204, headers: CORS_HEADERS });

      case 'tools/list':
        response = jsonRpcResponse(id, { tools: TOOLS });
        break;

      case 'tools/call': {
        const toolName = params?.name;
        const toolArgs = params?.arguments || {};

        try {
          let text: string;

          switch (toolName) {
            case 'search_mind':
              if (!toolArgs.query) {
                response = jsonRpcError(id, -32602, 'Missing required parameter: query');
                break;
              }
              text = await toolSearchMind(toolArgs);
              response = jsonRpcResponse(id, {
                content: [{ type: 'text', text }],
              });
              break;

            case 'get_profile':
              text = await toolGetProfile();
              response = jsonRpcResponse(id, {
                content: [{ type: 'text', text }],
              });
              break;

            case 'get_context':
              if (!toolArgs.topic) {
                response = jsonRpcError(id, -32602, 'Missing required parameter: topic');
                break;
              }
              text = await toolGetContext(toolArgs);
              response = jsonRpcResponse(id, {
                content: [{ type: 'text', text }],
              });
              break;

            default:
              response = jsonRpcError(id, -32602, `Unknown tool: ${toolName}`);
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Tool execution failed';
          response = jsonRpcResponse(id, {
            content: [{ type: 'text', text: `Error: ${msg}` }],
            isError: true,
          });
        }
        break;
      }

      case 'resources/list':
        response = jsonRpcResponse(id, { resources: RESOURCES });
        break;

      case 'resources/read': {
        const uri = params?.uri;
        try {
          let text: string;

          switch (uri) {
            case 'mindstore://profile':
              text = await resourceProfile();
              break;
            case 'mindstore://recent':
              text = await resourceRecent();
              break;
            default:
              response = jsonRpcError(id, -32602, `Unknown resource: ${uri}`);
              break;
          }

          if (!response) {
            response = jsonRpcResponse(id, {
              contents: [{ uri, mimeType: 'text/plain', text: text! }],
            });
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Resource read failed';
          response = jsonRpcError(id, -32603, msg);
        }
        break;
      }

      case 'ping':
        response = jsonRpcResponse(id, {});
        break;

      default:
        response = jsonRpcError(id, -32601, `Method not found: ${method}`);
    }

    return NextResponse.json(response, { headers: CORS_HEADERS });
  } catch {
    return NextResponse.json(
      jsonRpcError(null, -32700, 'Parse error'),
      { status: 400, headers: CORS_HEADERS }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { headers: CORS_HEADERS });
}
