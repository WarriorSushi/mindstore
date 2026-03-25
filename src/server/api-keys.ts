import { createHash, randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/server/db";

interface ApiKeySummaryRow {
  id: string;
  name: string | null;
  created_at: string | Date | null;
  last_used_at: string | Date | null;
}

interface ApiKeyLookupRow {
  id: string;
  user_id: string;
}

export interface ApiKeySummary {
  id: string;
  name: string;
  createdAt: string | null;
  lastUsedAt: string | null;
}

export function generateApiKeyValue() {
  return `msk_${randomBytes(24).toString("base64url")}`;
}

export function hashApiKeyValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function getApiKeyFromHeaders(
  headerBag: Pick<Headers, "get"> | { get(name: string): string | null }
) {
  const authorization = headerBag.get("authorization") ?? headerBag.get("Authorization");
  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length).trim();
  }

  return headerBag.get("x-api-key") ?? headerBag.get("x-mindstore-token");
}

export async function createApiKey(userId: string, name: string) {
  const rawKey = generateApiKeyValue();
  const hashedKey = hashApiKeyValue(rawKey);
  const result = await db.execute(sql`
    INSERT INTO api_keys (id, user_id, key, name, created_at)
    VALUES (gen_random_uuid(), ${userId}::uuid, ${hashedKey}, ${name}, NOW())
    RETURNING id, name, created_at, last_used_at
  `);
  const row = (result as unknown as ApiKeySummaryRow[])[0];

  return {
    rawKey,
    apiKey: mapApiKeyRow(row),
  };
}

export async function listApiKeys(userId: string) {
  const result = await db.execute(sql`
    SELECT id, name, created_at, last_used_at
    FROM api_keys
    WHERE user_id = ${userId}::uuid
    ORDER BY created_at DESC
  `);

  return (result as unknown as ApiKeySummaryRow[]).map(mapApiKeyRow);
}

export async function revokeApiKey(userId: string, id: string) {
  await db.execute(sql`
    DELETE FROM api_keys
    WHERE id = ${id}::uuid AND user_id = ${userId}::uuid
  `);
}

export async function resolveApiKeyUserId(rawKey: string) {
  const hashedKey = hashApiKeyValue(rawKey);

  try {
    const result = await db.execute(sql`
      SELECT id, user_id
      FROM api_keys
      WHERE key = ${hashedKey}
      LIMIT 1
    `);

    const row = (result as unknown as ApiKeyLookupRow[])[0];
    if (!row?.user_id) {
      return null;
    }

    await db.execute(sql`
      UPDATE api_keys
      SET last_used_at = NOW()
      WHERE id = ${row.id}::uuid
    `);

    return row.user_id;
  } catch {
    return null;
  }
}

function mapApiKeyRow(row: ApiKeySummaryRow): ApiKeySummary {
  return {
    id: row.id,
    name: row.name || "MindStore Everywhere",
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    lastUsedAt: row.last_used_at ? new Date(row.last_used_at).toISOString() : null,
  };
}
