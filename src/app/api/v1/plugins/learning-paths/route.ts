/**
 * Learning Path Generator Plugin — Route (thin wrapper)
 *
 * GET  ?action=list              — List all saved learning paths
 * GET  ?action=get&id=           — Get a single learning path
 * GET  ?action=suggestions       — Get AI-suggested topics
 * POST ?action=generate          — Generate a new learning path
 * POST ?action=update-progress   — Mark a node complete/incomplete
 * POST ?action=add-note          — Add personal note to a node
 * POST ?action=delete            — Delete a learning path
 *
 * Logic delegated to src/server/plugins/ports/learning-paths.ts
 */

import { getUserId } from '@/server/user';
import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/server/db';
import { sql, eq } from 'drizzle-orm';
import { retrieve } from '@/server/retrieval';
import { generateEmbeddings } from '@/server/embeddings';
import { resolveAIConfig, callAI } from '@/server/plugins/ai-caller';
import {
  getLearningPaths,
  saveLearningPaths,
  getPathById,
  deletePath,
  updateNodeProgress,
  addNodeNote,
  createPathFromAI,
  buildGeneratePrompt,
  buildSuggestionPrompt,
  getLearningSearchQueries,
} from '@/server/plugins/ports/learning-paths';

const PLUGIN_SLUG = 'learning-paths';

async function ensureInstalled() {
  const existing = await db.select().from(schema.plugins).where(eq(schema.plugins.slug, PLUGIN_SLUG)).limit(1);
  if (existing.length === 0) {
    await db.insert(schema.plugins).values({
      slug: PLUGIN_SLUG,
      name: 'Learning Path Generator',
      description: 'Structured learning plans based on your knowledge gaps. AI-designed curriculum.',
      version: '1.0.0',
      type: 'extension',
      status: 'active',
      icon: 'Route',
      category: 'action',
      config: {},
    });
  }
}

// ─── GET ─────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await ensureInstalled();

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'list';

    if (action === 'list') {
      const paths = await getLearningPaths();
      const summaries = paths.map(p => ({
        id: p.id, topic: p.topic, description: p.description, difficulty: p.difficulty,
        estimatedHours: p.estimatedHours, nodeCount: p.nodes.length,
        completedNodes: p.nodes.filter(n => n.completed).length,
        progress: p.progress, createdAt: p.createdAt, updatedAt: p.updatedAt,
      }));
      return NextResponse.json({ paths: summaries });
    }

    if (action === 'get') {
      const id = searchParams.get('id');
      if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
      const path = await getPathById(id);
      if (!path) return NextResponse.json({ error: 'Path not found' }, { status: 404 });
      return NextResponse.json({ path });
    }

    if (action === 'suggestions') {
      const aiConfig = await resolveAIConfig();
      if (!aiConfig) return NextResponse.json({ error: 'No AI provider configured' }, { status: 400 });

      const recentMemories = await db.execute(sql`
        SELECT source_title, content, source_type FROM memories
        WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 30
      `);
      const memoryContext = (recentMemories as any[])
        .map(m => `[${m.source_type}] ${m.source_title}: ${(m.content || '').slice(0, 150)}`)
        .join('\n');

      const { system, prompt } = buildSuggestionPrompt(memoryContext);
      const text = await callAI(aiConfig, prompt, { system, temperature: 0.5, maxTokens: 2048 });
      if (!text) return NextResponse.json({ suggestions: [] });

      try {
        const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
        const suggestions = JSON.parse(cleaned);
        return NextResponse.json({ suggestions: Array.isArray(suggestions) ? suggestions.slice(0, 6) : [] });
      } catch {
        return NextResponse.json({ suggestions: [] });
      }
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ─── POST ────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await ensureInstalled();

    const body = await req.json();
    const action = body.action;

    if (action === 'generate') {
      const { topic, context } = body;
      if (!topic) return NextResponse.json({ error: 'Missing topic' }, { status: 400 });

      const aiConfig = await resolveAIConfig();
      if (!aiConfig) return NextResponse.json({ error: 'No AI provider configured' }, { status: 400 });

      // Search existing knowledge
      let existingKnowledge: { id: string; title: string; preview: string; sourceType: string; content: string }[] = [];
      try {
        const queries = getLearningSearchQueries(topic);
        const allResults: any[] = [];
        for (const q of queries) {
          let embedding: number[] | null = null;
          try {
            const embs = await generateEmbeddings([q]);
            if (embs?.length) embedding = embs[0];
          } catch {}
          const results = await retrieve(q, embedding, { userId, limit: 10 });
          allResults.push(...results);
        }
        const seen = new Set<string>();
        for (const r of allResults) {
          if (!seen.has(r.id)) {
            seen.add(r.id);
            existingKnowledge.push({
              id: r.id,
              title: r.sourceTitle || r.source_title || 'Untitled',
              preview: (r.content || '').slice(0, 200),
              sourceType: r.sourceType || r.source_type || 'unknown',
              content: (r.content || '').slice(0, 500),
            });
          }
        }
        existingKnowledge = existingKnowledge.slice(0, 15);
      } catch {}

      const knowledgeContext = existingKnowledge.length > 0
        ? existingKnowledge.map(m => `- "${m.title}": ${m.preview}`).join('\n')
        : '';
      const { system, prompt } = buildGeneratePrompt(topic, knowledgeContext, context);
      const text = await callAI(aiConfig, prompt, { system, temperature: 0.5, maxTokens: 6144 });
      if (!text) return NextResponse.json({ error: 'AI generation failed' }, { status: 500 });

      try {
        const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleaned);
        const path = createPathFromAI(topic, parsed, existingKnowledge);

        const paths = await getLearningPaths();
        paths.unshift(path);
        if (paths.length > 20) paths.length = 20;
        await saveLearningPaths(paths);

        return NextResponse.json({ path });
      } catch {
        return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 });
      }
    }

    if (action === 'update-progress') {
      const { pathId, nodeId, completed } = body;
      if (!pathId || !nodeId) return NextResponse.json({ error: 'Missing pathId or nodeId' }, { status: 400 });
      try {
        const path = await updateNodeProgress(pathId, nodeId, completed !== false);
        return NextResponse.json({ path });
      } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 404 });
      }
    }

    if (action === 'add-note') {
      const { pathId, nodeId, note } = body;
      if (!pathId || !nodeId) return NextResponse.json({ error: 'Missing pathId or nodeId' }, { status: 400 });
      try {
        const path = await addNodeNote(pathId, nodeId, note || '');
        return NextResponse.json({ path });
      } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 404 });
      }
    }

    if (action === 'delete') {
      const { id } = body;
      if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
      try {
        await deletePath(id);
        return NextResponse.json({ success: true });
      } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 404 });
      }
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
