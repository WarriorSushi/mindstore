import { describe, expect, it } from "vitest";
import {
  extractText,
  extractLinks,
  parseExport,
  groupMessages,
  formatGroupMemory,
  processImport,
} from "@/server/plugins/ports/telegram-importer";

const SAMPLE_EXPORT = JSON.stringify({
  name: "Saved Messages",
  type: "saved_messages",
  messages: [
    {
      id: 1,
      type: "message",
      date: "2024-01-15T10:00:00",
      from: "Irfan",
      text: "Check out this AI article — very insightful",
    },
    {
      id: 2,
      type: "message",
      date: "2024-01-15T10:01:00",
      from: "Irfan",
      text: [
        "Also see ",
        { type: "text_link", text: "this link", href: "https://example.com/ai" },
        " for more details",
      ],
    },
    {
      id: 3,
      type: "message",
      date: "2024-01-15T12:00:00",
      from: "Alice",
      text: "Different sender, different time",
    },
  ],
});

describe("telegram importer port", () => {
  it("extracts text from mixed-content format", () => {
    const plain = extractText({ text: "Hello world" });
    expect(plain).toBe("Hello world");

    const rich = extractText({
      text: [
        "See ",
        { type: "bold", text: "this" },
        " and ",
        { type: "text_link", text: "link", href: "https://example.com" },
      ],
    });
    expect(rich).toContain("this");
    expect(rich).toContain("link");
  });

  it("extracts links from messages", () => {
    const links = extractLinks({
      text: [
        { type: "text_link", text: "click here", href: "https://example.com" },
        "plain text",
      ],
    });
    expect(links).toContain("https://example.com");
  });

  it("parses Telegram export JSON", () => {
    const result = parseExport(SAMPLE_EXPORT);

    expect(result.chatName).toBe("Saved Messages");
    expect(result.chatType).toBe("saved_messages");
    expect(result.messages).toHaveLength(3);
    expect(result.messages[0]?.from).toBe("Irfan");
  });

  it("groups sequential messages from same sender within 5 min", () => {
    const { messages } = parseExport(SAMPLE_EXPORT);
    const groups = groupMessages(messages);

    // Messages 1 & 2 should be grouped (same sender, 1 min apart)
    // Message 3 is separate (different sender, 2 hours later)
    expect(groups).toHaveLength(2);
    expect(groups[0]).toHaveLength(2);
    expect(groups[1]).toHaveLength(1);
  });

  it("formats a message group into a memory", () => {
    const { messages } = parseExport(SAMPLE_EXPORT);
    const groups = groupMessages(messages);
    const memory = formatGroupMemory(groups[0]!);

    expect(memory.content).toContain("AI article");
    expect(memory.metadata.chatName).toBe("Saved Messages");
    expect(memory.metadata.messageCount).toBe(2);
  });

  it("processes full import with filtering", () => {
    const result = processImport({ rawData: SAMPLE_EXPORT, minLength: 10 });

    expect(result.totalMessages).toBe(3);
    expect(result.memories.length).toBeGreaterThan(0);
    expect(result.groups).toBeGreaterThan(0);
  });
});
