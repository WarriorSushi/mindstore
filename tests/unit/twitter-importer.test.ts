import { describe, expect, it } from "vitest";
import {
  parseArchive,
  formatTweetMemory,
  processArchiveImport,
  formatManualTweets,
} from "@/server/plugins/ports/twitter-importer";

const SAMPLE_BOOKMARKS_JS = `window.YTD.bookmark.part0 = [
  {
    "bookmark": {
      "tweetId": "1234567890",
      "full_text": "This is a great tweet about TypeScript and React patterns.",
      "created_at": "Mon Jan 01 12:00:00 +0000 2024",
      "favorite_count": "42",
      "retweet_count": "10",
      "entities": {
        "hashtags": [{ "text": "TypeScript" }, { "text": "React" }],
        "urls": [{ "expanded_url": "https://example.com/blog" }]
      },
      "user": { "name": "Dev Author", "screen_name": "devauthor" }
    }
  },
  {
    "bookmark": {
      "tweetId": "9876543210"
    }
  }
];`;

describe("twitter importer port", () => {
  it("parses Twitter archive bookmarks JS format", () => {
    const tweets = parseArchive(SAMPLE_BOOKMARKS_JS);

    expect(tweets).toHaveLength(2);
    expect(tweets[0]?.text).toContain("TypeScript and React");
    expect(tweets[0]?.authorHandle).toBe("devauthor");
    expect(tweets[0]?.hashtags).toContain("TypeScript");
    expect(tweets[0]?.urls).toContain("https://example.com/blog");
  });

  it("formats a tweet into a memory-ready object", () => {
    const tweets = parseArchive(SAMPLE_BOOKMARKS_JS);
    const memory = formatTweetMemory(tweets[0]!);

    expect(memory.content).toContain("@devauthor");
    expect(memory.content).toContain("TypeScript and React");
    expect(memory.metadata.source).toBe("twitter");
    expect(memory.metadata.tweetId).toBe("1234567890");
    expect(memory.metadata.importedVia).toBe("twitter-importer-plugin");
    expect(memory.dedupKey).toBe("1234567890");
  });

  it("processes archive import, filtering empty tweets", () => {
    const result = processArchiveImport(SAMPLE_BOOKMARKS_JS);

    expect(result.total).toBe(2);
    expect(result.valid).toBe(1); // The bookmarked-only tweet is filtered
    expect(result.memories).toHaveLength(1);
    expect(result.memories[0]?.title).toContain("@devauthor");
  });

  it("formats manual tweet entries", () => {
    const memories = formatManualTweets([
      { text: "A manually saved quote from someone", author: "John Doe" },
      { text: "ab", author: "Too short" }, // should be filtered (< 3 chars)
    ]);

    expect(memories).toHaveLength(1);
    expect(memories[0]?.content).toContain("manually saved");
    expect(memories[0]?.metadata.importedVia).toBe("twitter-importer-plugin-manual");
  });
});
