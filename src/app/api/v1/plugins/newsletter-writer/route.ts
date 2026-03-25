/**
 * Newsletter Writer Plugin — Route (thin wrapper)
 *
 * GET  ?action=newsletters      — List all newsletters
 * GET  ?action=newsletter&id=   — Get single newsletter
 * GET  ?action=suggest&days=    — AI-suggest themes from recent memories
 * POST ?action=generate         — Generate newsletter from topic/timeframe
 * POST ?action=update           — Update a newsletter
 * POST ?action=refine           — AI refine a section
 * POST ?action=delete           — Delete a newsletter
 *
 * Logic delegated to src/server/plugins/ports/newsletter-writer.ts
 */

import { getUserId } from '@/server/user';
import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/server/db';
import { sql, eq } from 'drizzle-orm';
import { retrieve } from '@/server/retrieval';
import { generateEmbeddings } from '@/server/embeddings';
import { resolveAIConfig, type AIConfig } from '@/server/plugins/ai-caller';
import {
  summarizeNewsletters,
  suggestThemes,
  generateNewsletter,
  refineSection,
  updateNewsletter,
  getNewsletterDateNDaysAgo,
  getNewsletterPeriodLabel,
  type Newsletter,
  type NewsletterSection,
} from '@/server/plugins/ports/newsletter-writer';

const PLUGIN_SLUG = 'newsletter-writer';

// ─── Storage helpers ─────────────────────────────────────────

async function ensureInstalled() {
  const existing = await db.select().from(schema.plugins).where(eq(schema.plugins.slug, PLUGIN_SLUG)).limit(1);
  if (existing.length === 0) {
    await db.insert(schema.plugins).values({
      slug: PLUGIN_SLUG,
      name: 'Newsletter Writer',
      description: 'Auto-curate weekly digests from what you\'ve learned. Edit and export.',
      version: '1.0.0',
      type: 'extension',
      status: 'active',
      icon: 'Mail',
      category: 'action',
      config: {},
    });
  }
}

async function getNewsletters(): Promise<Newsletter[]> {
  const rows = await db.execute(sql`SELECT config FROM plugins WHERE slug = ${PLUGIN_SLUG}`);
  const row = (rows as any[])[0];
  if (!row?.config) return [];
  const config = typeof row.config === 'string' ? JSON.parse(row.config) : row.config;
  return config.newsletters || [];
}

async function saveNewsletters(newsletters: Newsletter[]) {
  const trimmed = newsletters.slice(0, 20);
  await db.execute(sql`
    UPDATE plugins
    SET config = jsonb_set(COALESCE(config, '{}'::jsonb), '{newsletters}', ${JSON.stringify(trimmed)}::jsonb),
        updated_at = NOW()
    WHERE slug = ${PLUGIN_SLUG}
  `);
}

// ─── GET ─────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    await ensureInstalled();
    const userId = await getUserId();
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'newsletters';

    if (action === 'newsletters') {
      const newsletters = await getNewsletters();
      return NextResponse.json({ newsletters: summarizeNewsletters(newsletters) });
    }

    if (action === 'newsletter') {
      const id = searchParams.get('id');
      if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
      const newsletters = await getNewsletters();
      const nl = newsletters.find(n => n.id === id);
      if (!nl) return NextResponse.json({ error: 'Newsletter not found' }, { status: 404 });
      return NextResponse.json({ newsletter: nl });
    }

    if (action === 'suggest') {
      const days = parseInt(searchParams.get('days') || '7');
      const sinceDate = getNewsletterDateNDaysAgo(days);

      const recentMemories = await db.execute(sql`
        SELECT id, title, content, source_type, created_at
        FROM memories
        WHERE user_id = ${userId} AND created_at >= ${sinceDate}::timestamp
        ORDER BY created_at DESC LIMIT 50
      `);
      const memoryList = recentMemories as any[];

      if (memoryList.length === 0) {
        return NextResponse.json({
          suggestion: null,
          message: `No memories found in the last ${days} days. Try a longer timeframe.`,
          memoryCount: 0,
        });
      }

      const aiConfig = await resolveAIConfig();
      const suggestions = await suggestThemes(memoryList, days, aiConfig);
      if (!suggestions) {
        return NextResponse.json({ error: 'AI suggestion failed — check provider config' }, { status: 500 });
      }
      return NextResponse.json({ suggestions, memoryCount: memoryList.length, period: getNewsletterPeriodLabel(days) });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}

// ─── POST ────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    await ensureInstalled();
    const userId = await getUserId();
    const body = await req.json();
    const action = body.action;

    if (action === 'generate') {
      const { periodDays = 7, focusTopics } = body;
      const sinceDate = getNewsletterDateNDaysAgo(periodDays);

      // Fetch recent memories
      const recentMemories = await db.execute(sql`
        SELECT id, title, content, source_type, created_at
        FROM memories
        WHERE user_id = ${userId} AND created_at >= ${sinceDate}::timestamp
        ORDER BY created_at DESC LIMIT 60
      `);
      const memoryList = recentMemories as any[];
      if (memoryList.length === 0) {
        return NextResponse.json({ error: `No memories in the last ${periodDays} days.` }, { status: 400 });
      }

      // RAG for focus topics
      let topicMemories: any[] = [];
      if (focusTopics?.length) {
        for (const topic of focusTopics.slice(0, 4)) {
          let embedding: number[] | null = null;
          try {
            const embeddings = await generateEmbeddings([topic]);
            if (embeddings?.length) embedding = embeddings[0];
          } catch { /* fallback */ }
          const results = await retrieve(topic, embedding, { userId, limit: 5 });
          topicMemories.push(...results);
        }
      }

      // Deduplicate
      const seenIds = new Set<string>();
      const allMemories: any[] = [];
      for (const m of [...memoryList, ...topicMemories]) {
        if (!seenIds.has(m.id)) { seenIds.add(m.id); allMemories.push(m); }
      }

      const aiConfig = await resolveAIConfig();
      const newsletter = await generateNewsletter(body, allMemories, aiConfig);
      if (!newsletter) {
        return NextResponse.json({ error: 'AI generation failed — try again' }, { status: 500 });
      }

      const newsletters = await getNewsletters();
      newsletters.unshift(newsletter);
      await saveNewsletters(newsletters);
      return NextResponse.json({ newsletter });
    }

    if (action === 'update') {
      const { id } = body;
      if (!id) return NextResponse.json({ error: 'Missing newsletter id' }, { status: 400 });

      const newsletters = await getNewsletters();
      const idx = newsletters.findIndex(n => n.id === id);
      if (idx === -1) return NextResponse.json({ error: 'Newsletter not found' }, { status: 404 });

      newsletters[idx] = updateNewsletter(newsletters[idx], body);
      await saveNewsletters(newsletters);
      return NextResponse.json({ newsletter: newsletters[idx] });
    }

    if (action === 'refine') {
      const { id, sectionId, instruction } = body;
      if (!id || !sectionId || !instruction) {
        return NextResponse.json({ error: 'Missing id, sectionId, or instruction' }, { status: 400 });
      }

      const newsletters = await getNewsletters();
      const nl = newsletters.find(n => n.id === id);
      if (!nl) return NextResponse.json({ error: 'Newsletter not found' }, { status: 404 });
      const section = nl.sections.find(s => s.id === sectionId);
      if (!section) return NextResponse.json({ error: 'Section not found' }, { status: 404 });

      const aiConfig = await resolveAIConfig();
      const refined = await refineSection(section, instruction, aiConfig);
      if (!refined) return NextResponse.json({ error: 'Refinement failed' }, { status: 500 });
      return NextResponse.json({ refined, sectionId });
    }

    if (action === 'delete') {
      const { id } = body;
      if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
      const newsletters = await getNewsletters();
      const filtered = newsletters.filter(n => n.id !== id);
      if (filtered.length === newsletters.length) {
        return NextResponse.json({ error: 'Newsletter not found' }, { status: 404 });
      }
      await saveNewsletters(filtered);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
