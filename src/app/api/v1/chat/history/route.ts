import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { sql } from 'drizzle-orm';
import { getUserId } from '@/server/user';

/**
 * Chat history — persists conversations to the database.
 * 
 * GET /api/v1/chat/history — list conversations
 * POST /api/v1/chat/history — save a conversation
 * GET /api/v1/chat/history/[id] — get a specific conversation
 * DELETE /api/v1/chat/history — delete conversations
 * 
 * Requires the `chat_conversations` table from the main migration.
 */

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId();
    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get('id');

    // Get specific conversation
    if (conversationId) {
      const result = await db.execute(sql`
        SELECT id, title, messages, model, memory_count, created_at, updated_at
        FROM chat_conversations
        WHERE id = ${conversationId}::uuid AND user_id = ${userId}::uuid
      `);
      const conv = (result as any[])[0];
      if (!conv) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
      return NextResponse.json(conv);
    }

    // List conversations
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const results = await db.execute(sql`
      SELECT id, title, model, memory_count, created_at, updated_at,
        jsonb_array_length(messages) as message_count
      FROM chat_conversations
      WHERE user_id = ${userId}::uuid
      ORDER BY updated_at DESC
      LIMIT ${limit}
    `);

    return NextResponse.json({
      conversations: (results as any[]).map(r => ({
        id: r.id,
        title: r.title,
        model: r.model,
        messageCount: r.message_count,
        memoryCount: r.memory_count,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
    });
  } catch (error: unknown) {
    return NextResponse.json({ conversations: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId();
    const body = await req.json();
    const { id, title, messages, model, memoryCount } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'messages array required' }, { status: 400 });
    }

    const msgJson = JSON.stringify(messages);

    // Auto-generate title from first user message if not provided
    const autoTitle = title || 
      messages.find((m: any) => m.role === 'user')?.content?.substring(0, 80) || 
      'New conversation';

    if (id) {
      // Update existing conversation
      await db.execute(sql`
        UPDATE chat_conversations
        SET messages = ${msgJson}::jsonb, title = ${autoTitle}, 
            model = ${model || null}, memory_count = ${memoryCount || 0},
            updated_at = NOW()
        WHERE id = ${id}::uuid AND user_id = ${userId}::uuid
      `);
      return NextResponse.json({ ok: true, id });
    }

    // Create new conversation
    const newId = crypto.randomUUID();
    await db.execute(sql`
      INSERT INTO chat_conversations (id, user_id, title, messages, model, memory_count)
      VALUES (${newId}, ${userId}::uuid, ${autoTitle}, ${msgJson}::jsonb, ${model || null}, ${memoryCount || 0})
    `);

    // Keep only last 100 conversations per user
    await db.execute(sql`
      DELETE FROM chat_conversations
      WHERE user_id = ${userId}::uuid
        AND id NOT IN (
          SELECT id FROM chat_conversations
          WHERE user_id = ${userId}::uuid
          ORDER BY updated_at DESC
          LIMIT 100
        )
    `);

    return NextResponse.json({ ok: true, id: newId });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const userId = await getUserId();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (id) {
      await db.execute(sql`
        DELETE FROM chat_conversations WHERE id = ${id}::uuid AND user_id = ${userId}::uuid
      `);
    } else {
      await db.execute(sql`
        DELETE FROM chat_conversations WHERE user_id = ${userId}::uuid
      `);
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return NextResponse.json({ ok: false });
  }
}
