import { describe, expect, it } from "vitest";
import { extractBridgeConcept } from "@/server/plugins/ports/contradiction-finder";

describe("contradiction finder port", () => {
  it("extracts a bridge concept from overlapping meaningful words", () => {
    const concept = extractBridgeConcept(
      "Remote work improves focus and flexibility for deep work.",
      "My notes say remote work still improves focus but can hurt collaboration.",
    );

    expect(concept).toContain("remote");
    expect(concept).toContain("work");
    expect(concept === "related concepts").toBe(false);
  });

  it("falls back when there is no useful overlap", () => {
    expect(extractBridgeConcept("alpha beta", "gamma delta")).toBe("related concepts");
  });
});
