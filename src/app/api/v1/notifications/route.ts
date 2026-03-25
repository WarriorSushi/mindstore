import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/server/db';
import { eq, desc, and, sql, count } from 'drizzle-orm';

const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001';

/**
 * GET /api/v1/notifications
 * 
 * Query params:
 *   - limit (default 20, max 100)
 *   - offset (default 0)
 *   - unread (if "true", only unread)
 * 
 * Returns: { notifications: [...], unreadCount: number, total: number }
 */
export async function GET(req: NextRequest) {
  try {
    // Ensure table exists
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE notification_type AS ENUM (
          'import_complete', 'analysis_ready', 'review_due', 'plugin_event',
          'system', 'export_ready', 'connection_found', 'milestone'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        type notification_type NOT NULL,
        title TEXT NOT NULL,
        body TEXT,
        icon TEXT,
        color TEXT DEFAULT 'teal',
        href TEXT,
        plugin_slug TEXT,
        metadata JSONB DEFAULT '{}',
        read INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at)`);

    const url = new URL(req.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const unreadOnly = url.searchParams.get('unread') === 'true';

    // Build conditions
    const conditions = [eq(schema.notifications.userId, DEFAULT_USER_ID)];
    if (unreadOnly) {
      conditions.push(eq(schema.notifications.read, 0));
    }

    // Fetch notifications
    const items = await db
      .select()
      .from(schema.notifications)
      .where(and(...conditions))
      .orderBy(desc(schema.notifications.createdAt))
      .limit(limit)
      .offset(offset);

    // Unread count
    const [unreadResult] = await db
      .select({ count: count() })
      .from(schema.notifications)
      .where(and(
        eq(schema.notifications.userId, DEFAULT_USER_ID),
        eq(schema.notifications.read, 0),
      ));

    // Total count
    const [totalResult] = await db
      .select({ count: count() })
      .from(schema.notifications)
      .where(eq(schema.notifications.userId, DEFAULT_USER_ID));

    return NextResponse.json({
      notifications: items.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        icon: n.icon,
        color: n.color,
        href: n.href,
        pluginSlug: n.pluginSlug,
        metadata: n.metadata,
        read: n.read === 1,
        createdAt: n.createdAt,
      })),
      unreadCount: unreadResult?.count || 0,
      total: totalResult?.count || 0,
    });
  } catch (e: any) {
    console.error('Notifications GET error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/**
 * POST /api/v1/notifications
 * 
 * Create a new notification. Used by plugins and internal systems.
 * 
 * Body: { type, title, body?, icon?, color?, href?, pluginSlug?, metadata? }
 * 
 * Special action: { action: "mark-read", id?: string }  — mark one or all as read
 * Special action: { action: "mark-all-read" }
 * Special action: { action: "clear-read" }  — delete all read notifications
 * Special action: { action: "delete", id: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Handle special actions
    if (body.action === 'mark-read' && body.id) {
      await db
        .update(schema.notifications)
        .set({ read: 1 })
        .where(and(
          eq(schema.notifications.id, body.id),
          eq(schema.notifications.userId, DEFAULT_USER_ID),
        ));
      return NextResponse.json({ ok: true });
    }

    if (body.action === 'mark-all-read') {
      await db
        .update(schema.notifications)
        .set({ read: 1 })
        .where(and(
          eq(schema.notifications.userId, DEFAULT_USER_ID),
          eq(schema.notifications.read, 0),
        ));
      return NextResponse.json({ ok: true });
    }

    if (body.action === 'clear-read') {
      await db
        .delete(schema.notifications)
        .where(and(
          eq(schema.notifications.userId, DEFAULT_USER_ID),
          eq(schema.notifications.read, 1),
        ));
      return NextResponse.json({ ok: true });
    }

    if (body.action === 'delete' && body.id) {
      await db
        .delete(schema.notifications)
        .where(and(
          eq(schema.notifications.id, body.id),
          eq(schema.notifications.userId, DEFAULT_USER_ID),
        ));
      return NextResponse.json({ ok: true });
    }

    // Create new notification
    const { type, title, body: notifBody, icon, color, href, pluginSlug, metadata } = body;

    if (!type || !title) {
      return NextResponse.json({ error: 'type and title are required' }, { status: 400 });
    }

    const validTypes = [
      'import_complete', 'analysis_ready', 'review_due', 'plugin_event',
      'system', 'export_ready', 'connection_found', 'milestone',
    ];
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: `Invalid type. Must be one of: ${validTypes.join(', ')}` }, { status: 400 });
    }

    const [notification] = await db
      .insert(schema.notifications)
      .values({
        userId: DEFAULT_USER_ID,
        type,
        title,
        body: notifBody || null,
        icon: icon || null,
        color: color || 'teal',
        href: href || null,
        pluginSlug: pluginSlug || null,
        metadata: metadata || {},
        read: 0,
      })
      .returning();

    return NextResponse.json({
      notification: {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        icon: notification.icon,
        color: notification.color,
        href: notification.href,
        pluginSlug: notification.pluginSlug,
        metadata: notification.metadata,
        read: false,
        createdAt: notification.createdAt,
      },
    });
  } catch (e: any) {
    console.error('Notifications POST error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
