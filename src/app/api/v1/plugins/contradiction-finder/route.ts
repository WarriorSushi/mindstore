/**
 * Contradiction Finder Plugin — Route (thin wrapper)
 *
 * GET  ?action=scan    — Run a new contradiction scan
 * GET  ?action=results — Get cached scan results
 * POST ?action=resolve — Resolve a contradiction
 * POST ?action=scan    — Run scan (POST variant)
 *
 * Logic delegated to src/server/plugins/ports/contradiction-finder.ts
 */

import { getUserId } from '@/server/user';
import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/server/db';
import { eq } from 'drizzle-orm';
import { resolveAIConfig, callAI } from '@/server/plugins/ai-caller';
import {
  findCandidatePairs,
  buildVerificationPrompt,
  parseVerificationResponse,
  storeContradiction,
  getCachedContradictions,
  resolveContradiction,
  keywordScan,
} from '@/server/plugins/ports/contradiction-finder';

const PLUGIN_SLUG = 'contradiction-finder';

async function ensureInstalled() {
  const existing = await db.select().from(schema.plugins).where(eq(schema.plugins.slug, PLUGIN_SLUG)).limit(1);
  if (existing.length === 0) {
    await db.insert(schema.plugins).values({
      slug: PLUGIN_SLUG,
      name: 'Contradiction Finder',
      description: 'Scans your memories for conflicting beliefs, outdated info, and inconsistencies.',
      version: '1.0.0',
      type: 'extension',
      status: 'active',
      icon: 'AlertTriangle',
      category: 'analysis',
      config: {},
    });
  }
}

// ─── GET ─────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    await ensureInstalled();
    const userId = await getUserId();
    const action = req.nextUrl.searchParams.get('action') || 'results';

    if (action === 'results') {
      const contradictions = await getCachedContradictions(userId);
      return NextResponse.json({ contradictions, count: contradictions.length });
    }

    if (action === 'scan') {
      return runScan(userId);
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
    const action = req.nextUrl.searchParams.get('action') || 'resolve';

    if (action === 'resolve') {
      const { contradictionId, resolution } = await req.json();
      if (!contradictionId) return NextResponse.json({ error: 'contradictionId required' }, { status: 400 });
      try {
        await resolveContradiction(userId, contradictionId, resolution);
        return NextResponse.json({ success: true, resolution });
      } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 404 });
      }
    }

    if (action === 'scan') {
      return runScan(userId);
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}

// ─── Scan orchestration ──────────────────────────────────────

async function runScan(userId: string) {
  const candidates = await findCandidatePairs(userId);

  if (candidates.length === 0) {
    return NextResponse.json({
      contradictions: [], count: 0, scanned: 0,
      message: 'No candidate pairs found. Import more knowledge to discover contradictions.',
    });
  }

  const aiConfig = await resolveAIConfig();

  if (!aiConfig) {
    // Keyword fallback
    const found = keywordScan(candidates);
    return NextResponse.json({
      contradictions: found, count: found.length, scanned: candidates.length,
      aiPowered: false,
      message: found.length > 0
        ? `Found ${found.length} potential contradiction${found.length > 1 ? 's' : ''} via keyword analysis. Connect an AI provider for deeper analysis.`
        : 'No contradictions detected via keyword analysis. Connect an AI provider for deeper analysis.',
    });
  }

  // AI-powered verification in batches of 5
  const BATCH_SIZE = 5;
  let newCount = 0;

  for (let i = 0; i < candidates.length && newCount < 20; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (c) => {
        const prompt = buildVerificationPrompt(c);
        const response = await callAI(aiConfig, prompt, { temperature: 0.1, maxTokens: 300 });
        if (!response) return null;
        const verified = parseVerificationResponse(response);
        if (!verified) return null;
        const stored = await storeContradiction(userId, c, verified);
        return stored ? verified : null;
      })
    );
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) newCount++;
    }
  }

  // Notification
  if (newCount > 0) {
    try {
      const { notifyAnalysisReady } = await import('@/server/notifications');
      await notifyAnalysisReady(
        'contradiction-finder',
        `${newCount} contradiction${newCount > 1 ? 's' : ''} found`,
        `Scanned ${candidates.length} memory pairs and found potential conflicts.`,
        '/app/insights',
      );
    } catch { /* non-fatal */ }
  }

  const contradictions = await getCachedContradictions(userId);
  return NextResponse.json({
    contradictions, count: contradictions.length,
    scanned: candidates.length, newFound: newCount,
    message: newCount > 0
      ? `Found ${newCount} new contradiction${newCount > 1 ? 's' : ''} across ${candidates.length} memory pairs.`
      : `Scanned ${candidates.length} memory pairs. No new contradictions found.`,
  });
}
