export function usesSupabaseTransactionPooler(connectionString: string): boolean {
  try {
    const url = new URL(connectionString);
    return url.hostname.includes("pooler.supabase.com") && url.port === "6543";
  } catch {
    return /pooler\.supabase\.com:6543/i.test(connectionString);
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
