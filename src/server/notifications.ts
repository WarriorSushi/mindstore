/**
 * Notification helper — creates notifications from server-side code.
 * Used by plugin APIs, import flows, and background jobs.
 */

import { db, schema } from '@/server/db';
import { sql } from 'drizzle-orm';
import { DEFAULT_USER_ID } from '@/server/identity';

type NotificationType =
  | 'import_complete'
  | 'analysis_ready'
  | 'review_due'
  | 'plugin_event'
  | 'system'
  | 'export_ready'
  | 'connection_found'
  | 'milestone';

interface CreateNotificationOptions {
  userId?: string;
  type: NotificationType;
  title: string;
  body?: string;
  icon?: string;
  color?: string;
  href?: string;
  pluginSlug?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Create a notification.
 * Non-throwing — notifications are best-effort, never break the main flow.
 */
export async function createNotification(opts: CreateNotificationOptions): Promise<void> {
  try {
    await db.insert(schema.notifications).values({
      userId: opts.userId ?? DEFAULT_USER_ID,
      type: opts.type,
      title: opts.title,
      body: opts.body || null,
      icon: opts.icon || null,
      color: opts.color || 'teal',
      href: opts.href || null,
      pluginSlug: opts.pluginSlug || null,
      metadata: opts.metadata || {},
      read: 0,
    });
  } catch (e) {
    // Never throw — notifications are best-effort
    console.error('Failed to create notification:', e);
  }
}

/**
 * Helper: notify import completion
 */
export function notifyImportComplete(
  pluginSlug: string,
  pluginName: string,
  count: number,
  href?: string,
  userId?: string,
) {
  return createNotification({
    userId,
    type: 'import_complete',
    title: `${count} items imported from ${pluginName}`,
    body: `Your ${pluginName.toLowerCase()} import is complete and ready to search.`,
    icon: 'Upload',
    color: 'teal',
    href: href || '/app/explore',
    pluginSlug,
  });
}

/**
 * Helper: notify analysis result
 */
export function notifyAnalysisReady(pluginSlug: string, title: string, body?: string, href?: string, userId?: string) {
  return createNotification({
    userId,
    type: 'analysis_ready',
    title,
    body,
    icon: 'BarChart3',
    color: 'sky',
    href: href || '/app/insights',
    pluginSlug,
  });
}

/**
 * Helper: milestone notification
 */
export function notifyMilestone(title: string, body?: string, userId?: string) {
  return createNotification({
    userId,
    type: 'milestone',
    title,
    body,
    icon: 'Trophy',
    color: 'amber',
    href: '/app/stats',
  });
}

/**
 * Helper: export ready
 */
export function notifyExportReady(pluginSlug: string, title: string, href?: string, userId?: string) {
  return createNotification({
    userId,
    type: 'export_ready',
    title,
    icon: 'Download',
    color: 'emerald',
    href: href || '/app/export',
    pluginSlug,
  });
}

/**
 * Check and notify memory count milestones.
 * Call after imports. Only fires once per milestone.
 */
const MILESTONES = [100, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000];

export async function checkMilestones(totalMemories: number, userId = DEFAULT_USER_ID): Promise<void> {
  try {
    for (const milestone of MILESTONES) {
      if (totalMemories >= milestone) {
        // Check if we already notified for this milestone
        const existing = await db.execute(
          sql`SELECT id FROM notifications WHERE user_id = ${userId}::uuid AND type = 'milestone' AND metadata->>'milestone' = ${String(milestone)} LIMIT 1`
        );
        if ((existing as any).length === 0) {
          await createNotification({
            userId,
            type: 'milestone',
            title: `🎉 ${milestone.toLocaleString()} memories!`,
            body: `You've reached ${milestone.toLocaleString()} memories in your knowledge base. Your mind keeps growing.`,
            icon: 'Trophy',
            color: 'amber',
            href: '/app/stats',
            metadata: { milestone },
          });
        }
      }
    }
  } catch (e) {
    // Non-fatal
  }
}
