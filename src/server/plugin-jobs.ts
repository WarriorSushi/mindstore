import { db, schema } from "@/server/db";
import { pluginRuntime } from "@/server/plugins/runtime";
import { getInstalledPluginMap } from "@/server/plugins/state";
import { and, eq, lte } from "drizzle-orm";

interface PluginRow {
  slug: string;
  metadata: unknown;
}

export interface PluginJobScheduleRecord {
  id: string;
  userId: string;
  pluginSlug: string;
  jobId: string;
  enabled: number;
  intervalMinutes: number;
  nextRunAt: Date | null;
  lastRunAt: Date | null;
  lastStatus: string | null;
  lastSummary: string | null;
  lastError: string | null;
  metadata: unknown;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface PluginJobScheduleState {
  jobId: string;
  pluginSlug: string;
  enabled: boolean;
  intervalMinutes: number;
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastStatus: string | null;
  lastSummary: string | null;
  lastError: string | null;
}

export interface PluginJobExecutionOutcome {
  jobId: string;
  pluginSlug: string;
  status: "success" | "warning" | "error";
  summary: string;
  details: string[];
  nextRunAt?: string | null;
}

export async function runPluginJob({
  userId,
  pluginSlug,
  jobId,
  reason,
}: {
  userId: string;
  pluginSlug: string;
  jobId: string;
  reason?: string;
}) {
  const installedMap = await getInstalledPluginMap();
  const jobBinding = pluginRuntime
    .getJobs(installedMap, { userId, slug: pluginSlug })
    .find((job) => job.definition.id === jobId);

  if (!jobBinding) {
    throw new Error(`Job ${jobId} is unavailable for plugin ${pluginSlug}.`);
  }

  const result = await jobBinding.run({ userId, reason });
  const status = result.status ?? "success";
  const details = result.details ?? [];
  const now = new Date();

  await updatePluginJobRunMetadata({
    pluginSlug,
    jobId,
    result: {
      lastRunAt: now.toISOString(),
      status,
      summary: result.summary,
      details,
      metadata: result.metadata ?? {},
    },
  });

  return {
    status,
    summary: result.summary,
    details,
    metadata: result.metadata ?? {},
    ranAt: now,
  };
}

export async function upsertPluginJobSchedule({
  userId,
  pluginSlug,
  jobId,
  enabled,
  intervalMinutes,
}: {
  userId: string;
  pluginSlug: string;
  jobId: string;
  enabled: boolean;
  intervalMinutes?: number;
}) {
  const normalizedInterval = Math.max(5, intervalMinutes ?? 1440);
  const nextRunAt = enabled ? computeNextRunAt(new Date(), normalizedInterval) : null;

  const [record] = await db
    .insert(schema.pluginJobSchedules)
    .values({
      userId,
      pluginSlug,
      jobId,
      enabled: enabled ? 1 : 0,
      intervalMinutes: normalizedInterval,
      nextRunAt,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [schema.pluginJobSchedules.userId, schema.pluginJobSchedules.pluginSlug, schema.pluginJobSchedules.jobId],
      set: {
        enabled: enabled ? 1 : 0,
        intervalMinutes: normalizedInterval,
        nextRunAt,
        updatedAt: new Date(),
      },
    })
    .returning();

  return mapScheduleRecord(record);
}

export async function getPluginJobSchedules(userId: string, pluginSlug?: string) {
  const conditions = pluginSlug
    ? and(
        eq(schema.pluginJobSchedules.userId, userId),
        eq(schema.pluginJobSchedules.pluginSlug, pluginSlug)
      )
    : eq(schema.pluginJobSchedules.userId, userId);

  const rows = await db
    .select()
    .from(schema.pluginJobSchedules)
    .where(conditions);

  return rows.map((row) => mapScheduleRecord(row));
}

export async function runDuePluginJobs({ limit = 10 }: { limit?: number } = {}) {
  const now = new Date();
  const dueSchedules = await db
    .select()
    .from(schema.pluginJobSchedules)
    .where(
      and(
        eq(schema.pluginJobSchedules.enabled, 1),
        lte(schema.pluginJobSchedules.nextRunAt, now)
      )
    )
    .limit(limit);

  const outcomes: PluginJobExecutionOutcome[] = [];

  for (const schedule of dueSchedules) {
    try {
      const result = await runPluginJob({
        userId: schedule.userId,
        pluginSlug: schedule.pluginSlug,
        jobId: schedule.jobId,
        reason: "scheduled",
      });

      const nextRunAt = computeNextRunAt(now, schedule.intervalMinutes);

      await db
        .update(schema.pluginJobSchedules)
        .set({
          lastRunAt: now,
          lastStatus: result.status,
          lastSummary: result.summary,
          lastError: null,
          nextRunAt,
          updatedAt: now,
        })
        .where(eq(schema.pluginJobSchedules.id, schedule.id));

      outcomes.push({
        jobId: schedule.jobId,
        pluginSlug: schedule.pluginSlug,
        status: result.status,
        summary: result.summary,
        details: result.details,
        nextRunAt: nextRunAt.toISOString(),
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Scheduled job failed";

      await db
        .update(schema.pluginJobSchedules)
        .set({
          lastRunAt: now,
          lastStatus: "error",
          lastSummary: "Scheduled execution failed",
          lastError: message,
          nextRunAt: computeNextRunAt(now, schedule.intervalMinutes),
          updatedAt: now,
        })
        .where(eq(schema.pluginJobSchedules.id, schedule.id));

      outcomes.push({
        jobId: schedule.jobId,
        pluginSlug: schedule.pluginSlug,
        status: "error",
        summary: "Scheduled execution failed",
        details: [message],
        nextRunAt: computeNextRunAt(now, schedule.intervalMinutes).toISOString(),
      });
    }
  }

  return outcomes;
}

export function computeNextRunAt(from: Date, intervalMinutes: number) {
  return new Date(from.getTime() + intervalMinutes * 60 * 1000);
}

function mapScheduleRecord(record: PluginJobScheduleRecord): PluginJobScheduleState {
  return {
    jobId: record.jobId,
    pluginSlug: record.pluginSlug,
    enabled: record.enabled === 1,
    intervalMinutes: record.intervalMinutes,
    nextRunAt: record.nextRunAt ? new Date(record.nextRunAt).toISOString() : null,
    lastRunAt: record.lastRunAt ? new Date(record.lastRunAt).toISOString() : null,
    lastStatus: record.lastStatus,
    lastSummary: record.lastSummary,
    lastError: record.lastError,
  };
}

async function updatePluginJobRunMetadata({
  pluginSlug,
  jobId,
  result,
}: {
  pluginSlug: string;
  jobId: string;
  result: {
    lastRunAt: string;
    status: string;
    summary: string;
    details: string[];
    metadata: Record<string, unknown>;
  };
}) {
  const [plugin] = await db
    .select({
      slug: schema.plugins.slug,
      metadata: schema.plugins.metadata,
    })
    .from(schema.plugins)
    .where(eq(schema.plugins.slug, pluginSlug))
    .limit(1);

  if (!plugin) {
    return;
  }

  const metadata = normalizePluginMetadata(plugin);
  const nextMetadata = {
    ...metadata,
    jobRuns: {
      ...getJobRuns(metadata),
      [jobId]: result,
    },
  };

  await db
    .update(schema.plugins)
    .set({ metadata: nextMetadata, updatedAt: new Date() })
    .where(eq(schema.plugins.slug, pluginSlug));
}

function normalizePluginMetadata(plugin: PluginRow) {
  if (!plugin.metadata || typeof plugin.metadata !== "object" || Array.isArray(plugin.metadata)) {
    return {};
  }

  return plugin.metadata as Record<string, unknown>;
}

function getJobRuns(metadata: Record<string, unknown>) {
  const jobRuns = metadata.jobRuns;
  if (!jobRuns || typeof jobRuns !== "object" || Array.isArray(jobRuns)) {
    return {};
  }

  return jobRuns as Record<string, unknown>;
}
