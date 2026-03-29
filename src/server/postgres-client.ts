function getConnectionHostKind(connectionString: string): DatabaseConnectionDiagnostics["hostKind"] {
  try {
    const url = new URL(connectionString);
    const hostname = url.hostname.toLowerCase();
    if (hostname.includes("pooler.supabase.com")) {
      return "supabase-pooler";
    }
    if (hostname.includes(".supabase.co")) {
      return "supabase-direct";
    }
    return "other";
  } catch {
    if (/pooler\.supabase\.com/i.test(connectionString)) {
      return "supabase-pooler";
    }
    if (/\.supabase\.co/i.test(connectionString)) {
      return "supabase-direct";
    }
    return "invalid";
  }
}

export function usesSupabaseTransactionPooler(connectionString: string): boolean {
  return getConnectionHostKind(connectionString) === "supabase-pooler" &&
    (() => {
      try {
        return new URL(connectionString).port === "6543";
      } catch {
        return /pooler\.supabase\.com:6543/i.test(connectionString);
      }
    })();
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
    const hostKind = getConnectionHostKind(connectionString);
    const sslRequired = url.searchParams.get("sslmode") === "require" || hostKind !== "other";
    const port = url.port ? Number(url.port) : null;

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
      hostKind: getConnectionHostKind(connectionString),
      sslRequired: false,
      port: null,
      preparedStatements: "enabled",
    };
  }
}

export function getPostgresClientOptions<T extends Record<string, unknown>>(
  connectionString: string,
  options: T,
): T & { prepare: boolean; ssl?: "require" } {
  const hostKind = getConnectionHostKind(connectionString);
  return {
    ...options,
    prepare: usesSupabaseTransactionPooler(connectionString) ? false : true,
    ...(hostKind === "supabase-pooler" || hostKind === "supabase-direct"
      ? { ssl: "require" as const }
      : {}),
  };
}
