/**
 * Domain-Specific Embeddings Plugin — Route (thin wrapper)
 *
 * GET  ?action=config           — Domain profiles, provider availability
 * GET  ?action=stats            — Domain distribution of memories
 * GET  ?action=detect&text=     — Detect domain for given text
 * GET  ?action=models&domain=   — Available models for a domain
 * POST ?action=save-config      — Save domain model configuration
 * POST ?action=tag-domain       — Tag a memory with a domain
 * POST ?action=batch-detect     — Auto-detect domains for untagged memories
 *
 * Logic delegated to src/server/plugins/ports/domain-embeddings.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/server/user';
import { db, schema } from '@/server/db';
import { sql, eq } from 'drizzle-orm';
import {
  DOMAIN_PROFILES,
  detectDomain,
  availableModelsForDomain,
} from '@/server/plugins/ports/domain-embeddings';

const PLUGIN_SLUG = 'domain-embeddings';

async function ensureInstalled() {
  try {
    const existing = await db.select().from(schema.plugins).where(eq(schema.plugins.slug, PLUGIN_SLUG)).limit(1);
    if (existing.length === 0) {
      await db.insert(schema.plugins).values({
        slug: PLUGIN_SLUG,
        name: 'Domain Embeddings',
        description: 'Specialized embedding models for specific knowledge domains.',
        version: '1.0.0',
        type: 'extension',
        status: 'active',
        icon: 'Dna',
        category: 'ai',
        config: {},
      });
    }
  } catch {}
}

async function getProviderAvailability() {
  const settings = await db.execute(sql`
    SELECT key, value FROM settings
    WHERE key IN ('openai_api_key', 'gemini_api_key', 'ollama_url', 'embedding_provider')
  `);
  const config: Record<string, string> = {};
  for (const row of settings as any[]) config[row.key] = row.value;

  return {
    providers: {
      openai: !!(config.openai_api_key || process.env.OPENAI_API_KEY),
      gemini: !!(config.gemini_api_key || process.env.GEMINI_API_KEY),
      ollama: !!(config.ollama_url || process.env.OLLAMA_URL),
    },
    currentProvider: config.embedding_provider || 'auto',
  };
}

// ─── GET ─────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId();
    await ensureInstalled();

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'config';

    if (action === 'config') {
      const pluginRows = await db.execute(sql`
        SELECT config FROM plugins WHERE slug = ${PLUGIN_SLUG}
      `);
      const pluginConfig = (pluginRows as any[])[0]?.config || {};
      const { providers, currentProvider } = await getProviderAvailability();

      return NextResponse.json({
        domains: DOMAIN_PROFILES,
        config: pluginConfig,
        availableProviders: providers,
        currentProvider,
      });
    }

    if (action === 'stats') {
      const allMemories = await db.execute(sql`
        SELECT id, content, metadata FROM memories
        WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 500
      `);

      const domainCounts: Record<string, number> = { general: 0 };
      const domainExamples: Record<string, string[]> = {};

      for (const mem of allMemories as any[]) {
        const content = mem.content || '';
        const existingDomain = mem.metadata?.domain;

        if (existingDomain) {
          domainCounts[existingDomain] = (domainCounts[existingDomain] || 0) + 1;
        } else {
          const detected = detectDomain(content);
          if (detected.length > 0 && detected[0].score > 0.05) {
            const domain = detected[0].domain;
            domainCounts[domain] = (domainCounts[domain] || 0) + 1;
            if (!domainExamples[domain]) domainExamples[domain] = [];
            if (domainExamples[domain].length < 3) domainExamples[domain].push(content.slice(0, 100));
          } else {
            domainCounts.general++;
          }
        }
      }

      const embStats = await db.execute(sql`
        SELECT COUNT(*) FILTER (WHERE embedding IS NOT NULL) as with_embeddings, COUNT(*) as total
        FROM memories WHERE user_id = ${userId}
      `);
      const eRow = (embStats as any[])[0] || {};

      return NextResponse.json({
        domainDistribution: Object.entries(domainCounts)
          .map(([domain, count]) => ({
            domain,
            name: DOMAIN_PROFILES.find(d => d.id === domain)?.name || domain,
            count,
            examples: domainExamples[domain] || [],
          }))
          .sort((a, b) => b.count - a.count),
        totalAnalyzed: (allMemories as any[]).length,
        embeddingCoverage: {
          withEmbeddings: parseInt(eRow.with_embeddings || '0'),
          total: parseInt(eRow.total || '0'),
        },
      });
    }

    if (action === 'detect') {
      const text = searchParams.get('text');
      if (!text) return NextResponse.json({ error: 'Missing text parameter' }, { status: 400 });
      const results = detectDomain(text);
      return NextResponse.json({
        detectedDomains: results,
        primaryDomain: results.length > 0 && results[0].score > 0.05 ? results[0] : { domain: 'general', score: 1, matches: [] },
      });
    }

    if (action === 'models') {
      const domainId = searchParams.get('domain') || 'general';
      const domain = DOMAIN_PROFILES.find(d => d.id === domainId);
      if (!domain) return NextResponse.json({ error: 'Unknown domain' }, { status: 404 });

      const { providers } = await getProviderAvailability();
      const models = domain.recommendedModels.map(m => ({
        ...m,
        available: (m.provider === 'openai' && providers.openai) ||
                   (m.provider === 'ollama' && providers.ollama) ||
                   m.provider === 'huggingface',
      }));
      return NextResponse.json({ domain: domain.id, models });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (e: any) {
    console.error('[domain-embeddings GET]', e);
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 });
  }
}

// ─── POST ────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'save-config';
    const userId = await getUserId();
    await ensureInstalled();

    if (action === 'save-config') {
      const body = await req.json();
      const { domainModels, autoDetect = true, defaultDomain = 'general' } = body;
      await db.execute(sql`
        UPDATE plugins SET config = config || ${JSON.stringify({ domainModels: domainModels || {}, autoDetect, defaultDomain })}::jsonb
        WHERE slug = ${PLUGIN_SLUG}
      `);
      return NextResponse.json({ saved: true });
    }

    if (action === 'tag-domain') {
      const body = await req.json();
      const { memoryId, domain } = body;
      if (!memoryId) return NextResponse.json({ error: 'Missing memoryId' }, { status: 400 });
      if (!DOMAIN_PROFILES.find(d => d.id === domain) && domain !== 'general') {
        return NextResponse.json({ error: 'Invalid domain' }, { status: 400 });
      }
      await db.execute(sql`
        UPDATE memories SET metadata = COALESCE(metadata, '{}'::jsonb) || ${JSON.stringify({ domain })}::jsonb
        WHERE id = ${memoryId} AND user_id = ${userId}
      `);
      return NextResponse.json({ tagged: true, memoryId, domain });
    }

    if (action === 'batch-detect') {
      const body = await req.json().catch(() => ({}));
      const batchSize = body.batchSize || 100;

      const untagged = await db.execute(sql`
        SELECT id, content, metadata FROM memories
        WHERE user_id = ${userId}
        AND (metadata->>'domain' IS NULL OR metadata->>'domain' = '')
        ORDER BY created_at DESC LIMIT ${batchSize}
      `);

      let tagged = 0;
      const domainCounts: Record<string, number> = {};

      for (const mem of untagged as any[]) {
        const detected = detectDomain(mem.content || '');
        const domain = detected.length > 0 && detected[0].score > 0.05 ? detected[0].domain : 'general';
        const newMeta = { ...(mem.metadata || {}), domain };
        await db.execute(sql`
          UPDATE memories SET metadata = ${JSON.stringify(newMeta)}::jsonb
          WHERE id = ${mem.id} AND user_id = ${userId}
        `);
        tagged++;
        domainCounts[domain] = (domainCounts[domain] || 0) + 1;
      }

      const remaining = await db.execute(sql`
        SELECT COUNT(*) as count FROM memories
        WHERE user_id = ${userId}
        AND (metadata->>'domain' IS NULL OR metadata->>'domain' = '')
      `);

      return NextResponse.json({
        tagged,
        remaining: parseInt((remaining as any[])[0]?.count || '0'),
        domainCounts,
      });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (e: any) {
    console.error('[domain-embeddings POST]', e);
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 });
  }
}
