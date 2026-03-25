/**
 * Markdown Blog Export Plugin — Route (thin wrapper)
 *
 * GET  ?action=config          — Get export options, memory stats, templates
 * GET  ?action=preview         — Preview export for selected memories
 * POST ?action=export          — Generate and download markdown ZIP
 *
 * Logic delegated to src/server/plugins/ports/markdown-blog-export.ts
 */

import { getUserId } from '@/server/user';
import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/server/db';
import { sql, eq } from 'drizzle-orm';
import JSZip from 'jszip';
import {
  type MemoryForExport,
  TEMPLATES,
  getTemplate,
  getFileName,
  buildExportContent,
  ASTRO_CONTENT_CONFIG,
} from '@/server/plugins/ports/markdown-blog-export';

const PLUGIN_SLUG = 'markdown-blog-export';

async function ensureInstalled() {
  try {
    const existing = await db.select().from(schema.plugins).where(eq(schema.plugins.slug, PLUGIN_SLUG)).limit(1);
    if (existing.length === 0) {
      await db.insert(schema.plugins).values({
        slug: PLUGIN_SLUG,
        name: 'Blog Export (Markdown)',
        description: 'Export your memories as blog-ready markdown for Hugo, Jekyll, Astro, Next.js, or plain markdown.',
        version: '1.0.0',
        type: 'extension',
        status: 'active',
        icon: 'FileDown',
        category: 'export',
        config: {},
      });
    }
  } catch {}
}

async function fetchMemories(userId: string, sourceType?: string): Promise<MemoryForExport[]> {
  const condition = sourceType
    ? sql`WHERE user_id = ${userId} AND source_type = ${sourceType} ORDER BY created_at DESC LIMIT 500`
    : sql`WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 500`;
  const rows = await db.execute(sql`
    SELECT id, content, source_type, source_title, metadata, created_at
    FROM memories ${condition}
  `);
  return (rows as any[]).map(r => ({
    id: r.id,
    content: r.content || '',
    source_type: r.source_type || 'note',
    source_title: r.source_title || '(untitled)',
    metadata: r.metadata || {},
    created_at: r.created_at,
  }));
}

// ─── GET ─────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId();
    await ensureInstalled();

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'config';

    if (action === 'config') {
      // Get source type stats
      const sourceRows = await db.execute(sql`
        SELECT source_type, COUNT(*) as count
        FROM memories WHERE user_id = ${userId}
        GROUP BY source_type ORDER BY count DESC
      `);
      const sourceTypes = (sourceRows as any[]).map(r => ({
        type: r.source_type || 'unknown',
        count: parseInt(r.count || '0'),
      }));
      const total = sourceTypes.reduce((s, t) => s + t.count, 0);

      return NextResponse.json({
        templates: TEMPLATES,
        stats: { total, sourceTypes },
      });
    }

    if (action === 'preview') {
      const templateId = searchParams.get('template') || 'plain';
      const sourceType = searchParams.get('sourceType') || undefined;
      const template = getTemplate(templateId);
      const memories = await fetchMemories(userId, sourceType);

      const previews = memories.slice(0, 5).map((m, i) => ({
        id: m.id,
        fileName: getFileName(m, template, i),
        title: m.source_title,
        preview: buildExportContent(m, template, { author: '', draft: false, includeMetadata: true }).slice(0, 500),
        wordCount: m.content.split(/\s+/).filter(Boolean).length,
      }));

      return NextResponse.json({ previews });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 });
  }
}

// ─── POST ────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId();
    await ensureInstalled();
    const body = await req.json();
    const action = body.action;

    if (action === 'export') {
      const {
        templateId = 'plain',
        sourceTypes,
        author = '',
        draft = false,
        includeMetadata = true,
        groupBySource = false,
      } = body;

      const template = getTemplate(templateId);
      let memories: MemoryForExport[];

      if (sourceTypes && sourceTypes.length > 0) {
        const allMems: MemoryForExport[] = [];
        for (const st of sourceTypes) {
          allMems.push(...(await fetchMemories(userId, st)));
        }
        memories = allMems;
      } else {
        memories = await fetchMemories(userId);
      }

      if (memories.length === 0) {
        return NextResponse.json({ error: 'No memories to export' }, { status: 400 });
      }

      const zip = new JSZip();
      let totalWords = 0;

      for (let i = 0; i < memories.length; i++) {
        const m = memories[i];
        const fileName = getFileName(m, template, i);
        const content = buildExportContent(m, template, { author, draft, includeMetadata });
        totalWords += m.content.split(/\s+/).filter(Boolean).length;

        const path = groupBySource
          ? `${template.contentDir}/${m.source_type}/${fileName}`
          : `${template.contentDir}/${fileName}`;
        zip.file(path, content);
      }

      // Astro: add content config
      if (templateId === 'astro') {
        zip.file('src/content/config.ts', ASTRO_CONTENT_CONFIG);
      }

      zip.file('README.md', [
        '# MindStore Blog Export',
        '',
        `Exported ${memories.length} posts on ${new Date().toISOString().slice(0, 10)}`,
        `Framework: ${template.name}`,
        `Total words: ${totalWords.toLocaleString()}`,
      ].join('\n'));

      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

      return NextResponse.json({
        file: zipBuffer.toString('base64'),
        filename: `mindstore_${templateId}_export.zip`,
        contentType: 'application/zip',
        stats: {
          postsExported: memories.length,
          totalWords,
          template: template.name,
        },
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 });
  }
}
