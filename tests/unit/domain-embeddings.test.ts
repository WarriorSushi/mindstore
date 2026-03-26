import { describe, expect, it } from "vitest";
import {
  DOMAIN_PROFILES,
  detectDomain,
  primaryDomain,
  getDomainProfile,
  availableModelsForDomain,
} from "@/server/plugins/ports/domain-embeddings";

describe("domain-embeddings port", () => {
  it("DOMAIN_PROFILES has 6 domains", () => {
    expect(DOMAIN_PROFILES).toHaveLength(6);
    const ids = DOMAIN_PROFILES.map((d) => d.id);
    expect(ids).toContain("general");
    expect(ids).toContain("code");
    expect(ids).toContain("medical");
    expect(ids).toContain("legal");
    expect(ids).toContain("scientific");
    expect(ids).toContain("financial");
  });

  it("each domain profile has required fields", () => {
    for (const profile of DOMAIN_PROFILES) {
      expect(profile.id).toBeTruthy();
      expect(profile.name).toBeTruthy();
      expect(profile.description).toBeTruthy();
      expect(profile.recommendedModels.length).toBeGreaterThan(0);
    }
  });

  it("detectDomain identifies code content", () => {
    const text = "import React from 'react'; const App = () => { return <div>Hello</div>; }; export default App;";
    const results = detectDomain(text);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.domain).toBe("code");
    expect(results[0]!.matches.length).toBeGreaterThan(0);
  });

  it("detectDomain identifies medical content", () => {
    const text = "The patient presented with symptoms of acute myocardial infarction. Treatment included thrombolysis and anticoagulant therapy. The prognosis remains guarded.";
    const results = detectDomain(text);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.domain).toBe("medical");
  });

  it("detectDomain identifies legal content", () => {
    const text = "The plaintiff filed a motion for summary judgment citing precedent from the appellate court. The defendant's counsel raised objections regarding jurisdiction.";
    const results = detectDomain(text);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.domain).toBe("legal");
  });

  it("detectDomain identifies financial content", () => {
    const text = "The company reported quarterly revenue of $2.3B with EBITDA margins improving to 25%. The P/E ratio suggests the stock is overvalued relative to market cap.";
    const results = detectDomain(text);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.domain).toBe("financial");
  });

  it("detectDomain identifies scientific content", () => {
    const text = "The hypothesis was tested using regression analysis. Results showed a statistically significant correlation (p-value < 0.01) between the variables.";
    const results = detectDomain(text);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.domain).toBe("scientific");
  });

  it("detectDomain returns empty for generic text", () => {
    const text = "The weather is nice today. I went to the store and bought some groceries.";
    const results = detectDomain(text);

    // Should have no strong matches or very low scores
    const highScores = results.filter((r) => r.score > 0.1);
    expect(highScores.length).toBe(0);
  });

  it("primaryDomain returns general for generic text", () => {
    const result = primaryDomain("Hello world, how are you?");
    expect(result.domain).toBe("general");
  });

  it("primaryDomain returns specific domain for specialized text", () => {
    const result = primaryDomain("async function fetchData() { const response = await fetch('/api/endpoint'); return response.json(); }");
    expect(result.domain).toBe("code");
    expect(result.score).toBeGreaterThan(0.05);
  });

  it("getDomainProfile returns correct profile", () => {
    const code = getDomainProfile("code");
    expect(code.name).toBe("Code & Programming");
    expect(code.keywords.length).toBeGreaterThan(0);
  });

  it("getDomainProfile returns general for unknown ID", () => {
    const unknown = getDomainProfile("nonexistent");
    expect(unknown.id).toBe("general");
  });

  it("availableModelsForDomain filters by provider", () => {
    const withOpenAI = availableModelsForDomain("general", { openai: true, ollama: false });
    expect(withOpenAI.every((m) => m.provider === "openai")).toBe(true);

    const withOllama = availableModelsForDomain("general", { openai: false, ollama: true });
    expect(withOllama.every((m) => m.provider === "ollama")).toBe(true);

    const withBoth = availableModelsForDomain("general", { openai: true, ollama: true });
    expect(withBoth.length).toBeGreaterThanOrEqual(withOpenAI.length);
  });

  it("availableModelsForDomain returns empty with no providers", () => {
    const none = availableModelsForDomain("code", { openai: false, ollama: false });
    expect(none).toHaveLength(0);
  });
});
