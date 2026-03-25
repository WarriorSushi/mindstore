/**
 * Conversation Prep Plugin — Route (thin wrapper)
 *
 * GET  ?action=history           — List past briefings
 * GET  ?action=briefing&id=      — Get a single briefing
 * POST ?action=prepare           — Generate a new briefing
 * POST ?action=delete            — Delete a briefing
 * POST ?action=follow-up         — Ask a follow-up question about a briefing
 *
 * Logic delegated to src/server/plugins/ports/conversation-prep.ts
 */

import { getUserId } from '@/server/user';
import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/server/db';
import { sql, eq } from 'drizzle-orm';
import { retrieve } from '@/server/retrieval';
import { generateEmbeddings } from '@/server/embeddings';
import { resolveAIConfig, callAI } from '@/server/plugins/ai-caller';
import {
  getBriefings,
  saveBriefings,
  getBriefingById,
  listBriefingSummaries,
  deleteBriefing,
  buildSearchQueries,
  buildBriefingPrompt,
  buildFollowUpPrompt,
  buildKnowledgeContext,
  parseBriefingSections,
  createBriefingObject,
} from '@/server/plugins/ports/conversation-prep';

const PLUGIN_SLUG = 'conversation-prep';

async function ensureInstalled() {
  const existing = await db.select().from(schema.plugins).where(eq(schema.plugins.slug, PLUGIN_SLUG)).limit(1);
  if (existing.length === 0) {
    await db.insert(schema.plugins).values({
      slug: PLUGIN_SLUG,
      name: 'Conversation Prep',
      description: 'Get briefed before any meeting or conversation — everything you know about a person or topic, organized.',
      version: '1.0.0',
      type: 'extension',
      status: 'active',
      icon: 'Users',
      category: 'action',
      config: {},
    });
  }
}

// ─── GET ─────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    await ensureInstalled();
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'history';

    if (action === 'history') {
      return NextResponse.json({ briefings: await listBriefingSummaries() });
    }

    if (action === 'briefing') {
      const id = searchParams.get('id');
      if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
      const briefing = await getBriefingById(id);
      if (!briefing) return NextResponse.json({ error: 'Briefing not found' }, { status: 404 });
      return NextResponse.json({ briefing });
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

    if (action === 'prepare') {
      const { subject, type = 'topic', context = '' } = body;
      if (!subject?.trim()) {
        return NextResponse.json({ error: 'Subject required — who or what are you meeting about?' }, { status: 400 });
      }

      // 1. Multi-query retrieval
      const searchQueries = buildSearchQueries(subject, type, context);
      const allResults: any[] = [];
      const seenIds = new Set<string>();

      for (const query of searchQueries) {
        let embedding: number[] | null = null;
        try {
          const embs = await generateEmbeddings([query]);
          if (embs?.length) embedding = embs[0];
        } catch { /* fallback */ }

        const results = await retrieve(query, embedding, { userId, limit: 8 });
        for (const r of results) {
          if (!seenIds.has(r.memoryId)) {
            seenIds.add(r.memoryId);
            allResults.push(r);
          }
        }
      }

      if (allResults.length === 0) {
        return NextResponse.json({
          error: `No relevant memories found about "${subject}". Try adding more knowledge first, or check the spelling.`,
        }, { status: 400 });
      }

      allResults.sort((a, b) => (b.score || 0) - (a.score || 0));
      const topResults = allResults.slice(0, 20);

      // 2. AI generation
      const aiConfig = await resolveAIConfig();
      if (!aiConfig) return NextResponse.json({ error: 'No AI provider configured' }, { status: 400 });

      const knowledgeContext = buildKnowledgeContext(topResults);
      const { system, prompt } = buildBriefingPrompt(subject, type, context, knowledgeContext);
      const result = await callAI(aiConfig, prompt, { system, temperature: 0.4, maxTokens: 4096 });
      if (!result) return NextResponse.json({ error: 'AI generation failed — try again' }, { status: 500 });

      const sections = parseBriefingSections(result);
      if (sections.length === 0) {
        return NextResponse.json({ error: 'Could not generate a meaningful briefing from available knowledge' }, { status: 500 });
      }

      // 3. Save briefing
      const briefing = createBriefingObject(
        subject, type, context || undefined, sections,
        topResults.map((m: any) => m.memoryId).filter(Boolean),
      );
      const briefings = await getBriefings();
      briefings.push(briefing);
      if (briefings.length > 50) briefings.splice(0, briefings.length - 50);
      await saveBriefings(briefings);

      return NextResponse.json({ briefing });
    }

    if (action === 'follow-up') {
      const { id, question } = body;
      if (!id || !question?.trim()) {
        return NextResponse.json({ error: 'Missing briefing id or question' }, { status: 400 });
      }

      const briefing = await getBriefingById(id);
      if (!briefing) return NextResponse.json({ error: 'Briefing not found' }, { status: 404 });

      let embedding: number[] | null = null;
      try {
        const embs = await generateEmbeddings([`${briefing.subject} ${question}`]);
        if (embs?.length) embedding = embs[0];
      } catch { /* fallback */ }

      const results = await retrieve(`${briefing.subject} ${question}`, embedding, { userId, limit: 10 });
      const additionalContext = results
        .map((m: any, i: number) => `[${i + 1}] ${m.sourceTitle || '(untitled)'}: ${m.content?.slice(0, 500) || ''}`)
        .join('\n\n');

      const aiConfig = await resolveAIConfig();
      if (!aiConfig) return NextResponse.json({ error: 'No AI provider configured' }, { status: 400 });

      const { system, prompt } = buildFollowUpPrompt(briefing, question, additionalContext);
      const answer = await callAI(aiConfig, prompt, { system, temperature: 0.4, maxTokens: 1024 });
      if (!answer) return NextResponse.json({ error: 'Failed to generate answer' }, { status: 500 });

      return NextResponse.json({ answer });
    }

    if (action === 'delete') {
      const { id } = body;
      if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
      try {
        await deleteBriefing(id);
        return NextResponse.json({ success: true });
      } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 404 });
      }
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
