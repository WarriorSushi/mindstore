export function usesSupabaseTransactionPooler(connectionString: string): boolean {
  try {
    const url = new URL(connectionString);
    return url.hostname.includes("pooler.supabase.com") && url.port === "6543";
  } catch {
    return /pooler\.supabase\.com:6543/i.test(connectionString);
  }
}

export interface DatabaseConnectionDiagnostics {
  configured: boolean;
  hostKind: "supabase-pooler" | "supabase-direct" | "other" | "invalid";
  sslRequired: boolean;
  port: number | null;
  preparedStatements: "enabled" | "disabled";
}

export function getDatabaseConnectionDiagnostics(connectionString?: string): DatabaseConnectionDiagnostics {
  if (!connectionString) {
    return {
      configured: false,
      hostKind: "invalid",
      sslRequired: false,
      port: null,
      preparedStatements: "enabled",
    };
  }

  try {
    const url = new URL(connectionString);
    const hostname = url.hostname.toLowerCase();
    const sslRequired = url.searchParams.get("sslmode") === "require";
    const port = url.port ? Number(url.port) : null;

    let hostKind: DatabaseConnectionDiagnostics["hostKind"] = "other";
    if (hostname.includes("pooler.supabase.com")) {
      hostKind = "supabase-pooler";
    } else if (hostname.includes(".supabase.co")) {
      hostKind = "supabase-direct";
    }

    return {
      configured: true,
      hostKind,
      sslRequired,
      port,
      preparedStatements: usesSupabaseTransactionPooler(connectionString) ? "disabled" : "enabled",
    };
  } catch {
    return {
      configured: true,
      hostKind: "invalid",
      sslRequired: false,
      port: null,
      preparedStatements: "enabled",
    };
  }
}

export function getPostgresClientOptions<T extends Record<string, unknown>>(
  connectionString: string,
  options: T,
): T & { prepare: boolean } {
  return {
    ...options,
    prepare: usesSupabaseTransactionPooler(connectionString) ? false : true,
  };
}
