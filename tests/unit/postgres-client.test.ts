import { describe, expect, it } from "vitest";
import {
  getDatabaseConnectionDiagnostics,
  getPostgresClientOptions,
  usesSupabaseTransactionPooler,
} from "@/server/postgres-client";

describe("postgres client helpers", () => {
  const supabasePoolerUrl =
    "postgresql://postgres.example:secret@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres";

  it("detects Supabase transaction pooler URLs", () => {
    expect(usesSupabaseTransactionPooler(supabasePoolerUrl)).toBe(true);
  });

  it("forces SSL and disables prepared statements for Supabase poolers", () => {
    const options = getPostgresClientOptions(supabasePoolerUrl, { max: 10 });

    expect(options.prepare).toBe(false);
    expect(options.ssl).toBe("require");
  });

  it("reports effective SSL as required for Supabase URLs", () => {
    const diagnostics = getDatabaseConnectionDiagnostics(supabasePoolerUrl);

    expect(diagnostics.hostKind).toBe("supabase-pooler");
    expect(diagnostics.sslRequired).toBe(true);
    expect(diagnostics.port).toBe(6543);
  });
});
