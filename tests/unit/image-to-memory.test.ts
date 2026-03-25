import { describe, expect, it } from "vitest";
import {
  extractTagsFromResponse,
  buildAnalysisPrompt,
  generateTitleFromDescription,
  buildOpenAIVisionRequest,
  buildGeminiVisionRequest,
  buildOllamaVisionRequest,
  formatImageMemoryContent,
  CONTEXT_PROMPTS,
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_SIZE,
} from "@/server/plugins/ports/image-to-memory";

describe("image-to-memory port", () => {
  it("extracts tags from AI response text", () => {
    const result = extractTagsFromResponse(
      'This image shows a sunset over the ocean.\n\nTAGS: ["sunset", "ocean", "nature", "landscape"]',
    );

    expect(result.description).toContain("sunset over the ocean");
    expect(result.tags).toEqual(["sunset", "ocean", "nature", "landscape"]);
    expect(result.description).not.toContain("TAGS:");
  });

  it("handles response with no tags", () => {
    const result = extractTagsFromResponse("Just a plain description with no tag line.");

    expect(result.description).toBe("Just a plain description with no tag line.");
    expect(result.tags).toEqual([]);
  });

  it("builds analysis prompt with context", () => {
    const prompt = buildAnalysisPrompt("screenshot");
    expect(prompt).toContain("screenshot");
    expect(prompt).toContain("application/website");

    const custom = buildAnalysisPrompt("general", "Focus on the architecture");
    expect(custom).toContain("Focus on the architecture");
  });

  it("generates title from description", () => {
    const short = generateTitleFromDescription("A cat sitting on a mat.");
    expect(short).toBe("A cat sitting on a mat");

    const long = generateTitleFromDescription(
      "This is a very long description that goes on and on about the details of an incredibly complex image with many elements.",
    );
    expect(long.length).toBeLessThanOrEqual(60);
    expect(long).toContain("...");
  });

  it("builds OpenAI vision request with base64 image", () => {
    const req = buildOpenAIVisionRequest("gpt-4o", "abc123", "image/png", "Describe this");

    expect(req).toHaveProperty("model", "gpt-4o");
    expect(req).toHaveProperty("messages");
    expect(req).toHaveProperty("max_tokens", 1500);
  });

  it("builds Gemini vision request", () => {
    const req = buildGeminiVisionRequest("abc123", "image/jpeg", "Describe this");

    expect(req).toHaveProperty("contents");
    expect(req).toHaveProperty("generationConfig");
  });

  it("builds Ollama vision request", () => {
    const req = buildOllamaVisionRequest("llava", "abc123", "Describe this");

    expect(req).toHaveProperty("model", "llava");
    expect(req).toHaveProperty("images");
  });

  it("formats memory content with title, description, and tags", () => {
    const content = formatImageMemoryContent(
      "Beach Sunset",
      "A beautiful sunset over the beach.",
      ["sunset", "beach"],
      "photo",
    );

    expect(content).toContain("# Beach Sunset");
    expect(content).toContain("A beautiful sunset");
    expect(content).toContain("Tags: sunset, beach");
    expect(content).toContain("Type: photo");
  });

  it("has all context types defined", () => {
    expect(CONTEXT_PROMPTS.general).toBeDefined();
    expect(CONTEXT_PROMPTS.screenshot).toBeDefined();
    expect(CONTEXT_PROMPTS.whiteboard).toBeDefined();
    expect(CONTEXT_PROMPTS.document).toBeDefined();
    expect(CONTEXT_PROMPTS.diagram).toBeDefined();
    expect(CONTEXT_PROMPTS.photo).toBeDefined();
    expect(CONTEXT_PROMPTS.chart).toBeDefined();
    expect(CONTEXT_PROMPTS.meme).toBeDefined();
  });

  it("has correct constants", () => {
    expect(ALLOWED_IMAGE_TYPES).toContain("image/jpeg");
    expect(ALLOWED_IMAGE_TYPES).toContain("image/png");
    expect(MAX_IMAGE_SIZE).toBe(20 * 1024 * 1024);
  });
});
