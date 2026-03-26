import { describe, expect, it } from "vitest";
import {
  LANGUAGES,
  detectScript,
  heuristicDetect,
  detectLanguage,
  languageName,
  supportedLanguages,
} from "@/server/plugins/ports/multi-language";

describe("multi-language port", () => {
  it("LANGUAGES has 50+ entries", () => {
    const count = Object.keys(LANGUAGES).length;
    expect(count).toBeGreaterThan(50);
    expect(LANGUAGES["en"]).toBe("English");
    expect(LANGUAGES["ja"]).toBe("Japanese");
    expect(LANGUAGES["ar"]).toBe("Arabic");
    expect(LANGUAGES["hi"]).toBe("Hindi");
  });

  it("detectScript identifies Latin script", () => {
    const results = detectScript("Hello world this is English text");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.script).toBe("Latin");
    expect(results[0]!.ratio).toBeGreaterThan(0.8);
  });

  it("detectScript identifies Cyrillic script", () => {
    const results = detectScript("Привет мир это русский текст");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.script).toBe("Cyrillic");
  });

  it("detectScript identifies Arabic script", () => {
    const results = detectScript("مرحبا بالعالم هذا نص عربي");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.script).toBe("Arabic");
  });

  it("detectScript identifies CJK", () => {
    const results = detectScript("你好世界这是中文文本");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.script).toBe("CJK");
  });

  it("detectScript identifies Hangul (Korean)", () => {
    const results = detectScript("안녕하세요 세계");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.script).toBe("Hangul");
  });

  it("detectScript identifies Devanagari (Hindi)", () => {
    const results = detectScript("नमस्ते दुनिया");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.script).toBe("Devanagari");
  });

  it("detectScript identifies mixed scripts", () => {
    const results = detectScript("Hello мир 世界");
    expect(results.length).toBeGreaterThan(1);
  });

  it("heuristicDetect identifies Russian from Cyrillic", () => {
    const result = heuristicDetect("Привет мир это русский текст");
    expect(result).not.toBeNull();
    expect(result!.code).toBe("ru");
    expect(result!.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it("heuristicDetect identifies Arabic", () => {
    const result = heuristicDetect("مرحبا بالعالم هذا نص عربي");
    expect(result).not.toBeNull();
    expect(result!.code).toBe("ar");
  });

  it("heuristicDetect identifies Japanese (Hiragana)", () => {
    const result = heuristicDetect("こんにちは世界");
    expect(result).not.toBeNull();
    expect(result!.code).toBe("ja");
    expect(result!.confidence).toBe(0.85);
  });

  it("heuristicDetect identifies Chinese (CJK only)", () => {
    const result = heuristicDetect("你好世界这是中文");
    expect(result).not.toBeNull();
    expect(result!.code).toBe("zh");
  });

  it("heuristicDetect identifies Korean", () => {
    const result = heuristicDetect("안녕하세요 세계");
    expect(result).not.toBeNull();
    expect(result!.code).toBe("ko");
  });

  it("heuristicDetect returns low confidence for Latin text", () => {
    const result = heuristicDetect("Hello world this is English");
    expect(result).not.toBeNull();
    expect(result!.code).toBe("en");
    expect(result!.confidence).toBe(0.3); // Low — can't distinguish Latin languages
  });

  it("heuristicDetect returns null for empty text", () => {
    const result = heuristicDetect("");
    expect(result).toBeNull();
  });

  it("detectLanguage uses heuristic for non-Latin scripts", async () => {
    const { language, method } = await detectLanguage("Привет мир", null);
    expect(method).toBe("heuristic");
    expect(language.code).toBe("ru");
  });

  it("detectLanguage falls back to heuristic when no AI", async () => {
    const { language, method } = await detectLanguage("Hello world", null);
    expect(method).toBe("heuristic-fallback");
    expect(language.code).toBe("en");
  });

  it("languageName returns correct name", () => {
    expect(languageName("en")).toBe("English");
    expect(languageName("ja")).toBe("Japanese");
    expect(languageName("unknown")).toBe("unknown");
  });

  it("supportedLanguages returns array of code/name pairs", () => {
    const langs = supportedLanguages();
    expect(langs.length).toBeGreaterThan(50);
    expect(langs[0]).toHaveProperty("code");
    expect(langs[0]).toHaveProperty("name");
    expect(langs.find((l) => l.code === "en")?.name).toBe("English");
  });
});
