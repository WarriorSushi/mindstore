import { describe, expect, it } from "vitest";
import { buildConversationSearchQueries } from "@/server/plugins/ports/conversation-prep";

describe("conversation prep port", () => {
  it("builds base query for a topic type", () => {
    const queries = buildConversationSearchQueries("React hooks", "topic");
    expect(queries[0]).toBe("React hooks");
    expect(queries).toContain("React hooks notes");
    expect(queries).toContain("React hooks insights");
  });

  it("builds person-specific queries", () => {
    const queries = buildConversationSearchQueries("Alice", "person");
    expect(queries).toContain("Alice conversation");
    expect(queries).toContain("Alice meeting notes");
    expect(queries).toContain("Alice project");
  });

  it("builds company-specific queries", () => {
    const queries = buildConversationSearchQueries("Acme Corp", "company");
    expect(queries).toContain("Acme Corp business");
    expect(queries).toContain("Acme Corp product");
    expect(queries).toContain("Acme Corp partnership");
  });

  it("builds project-specific queries", () => {
    const queries = buildConversationSearchQueries("MindStore", "project");
    expect(queries).toContain("MindStore status");
    expect(queries).toContain("MindStore issues");
    expect(queries).toContain("MindStore decisions");
  });

  it("includes context in queries when provided", () => {
    const queries = buildConversationSearchQueries("Alice", "person", "quarterly review");
    expect(queries).toContain("Alice quarterly review");
  });

  it("omits context query when context is empty", () => {
    const queries = buildConversationSearchQueries("Alice", "person");
    // Should not have a query with trailing space
    expect(queries.every((q) => !q.endsWith(" "))).toBe(true);
  });
});
