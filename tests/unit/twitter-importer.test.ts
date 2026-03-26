import { describe, expect, it } from "vitest";
import {
  parseArchive,
  formatTweetMemory,
  processArchiveImport,
  formatManualTweets,
  type ParsedTweet,
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

  it("handles bookmark-only entries (tweetId only, no text)", () => {
    const tweets = parseArchive(SAMPLE_BOOKMARKS_JS);
    const bookmarkOnly = tweets.find(t => t.id === "9876543210");

    expect(bookmarkOnly).toBeDefined();
    expect(bookmarkOnly!.text).toContain("Bookmarked tweet ID");
  });

  it("extracts hashtags from tweet entities", () => {
    const tweets = parseArchive(SAMPLE_BOOKMARKS_JS);
    const tweet = tweets[0]!;

    expect(tweet.hashtags).toEqual(["TypeScript", "React"]);
  });

  it("extracts URLs from tweet entities", () => {
    const tweets = parseArchive(SAMPLE_BOOKMARKS_JS);
    const tweet = tweets[0]!;

    expect(tweet.urls).toEqual(["https://example.com/blog"]);
  });

  it("parses like and retweet counts as numbers", () => {
    const tweets = parseArchive(SAMPLE_BOOKMARKS_JS);
    const tweet = tweets[0]!;

    expect(tweet.likes).toBe(42);
    expect(tweet.retweets).toBe(10);
  });

  it("handles tweets using 'tweet' wrapper instead of 'bookmark'", () => {
    const tweetArchive = `window.YTD.tweet.part0 = [
      {
        "tweet": {
          "id_str": "111222333",
          "full_text": "A regular tweet from my archive",
          "created_at": "Tue Feb 01 08:00:00 +0000 2024",
          "favorite_count": "5",
          "retweet_count": "1",
          "entities": { "hashtags": [], "urls": [] },
          "user": { "name": "Me", "screen_name": "myhandle" }
        }
      }
    ];`;

    const tweets = parseArchive(tweetArchive);

    expect(tweets).toHaveLength(1);
    expect(tweets[0]?.id).toBe("111222333");
    expect(tweets[0]?.text).toBe("A regular tweet from my archive");
    expect(tweets[0]?.authorHandle).toBe("myhandle");
  });

  it("sets dedupKey from tweet ID", () => {
    const tweets = parseArchive(SAMPLE_BOOKMARKS_JS);
    const memory = formatTweetMemory(tweets[0]!);

    expect(memory.dedupKey).toBe("1234567890");
  });

  it("includes tweet ID in memory metadata", () => {
    const tweets = parseArchive(SAMPLE_BOOKMARKS_JS);
    const memory = formatTweetMemory(tweets[0]!);

    expect(memory.metadata.tweetId).toBe("1234567890");
    expect(memory.metadata.source).toBe("twitter");
  });

  it("manual tweets accept 'content' as alternative to 'text'", () => {
    const memories = formatManualTweets([
      { content: "Using content field instead of text", author: "Author" },
    ]);

    expect(memories).toHaveLength(1);
    expect(memories[0]?.content).toContain("Using content field");
  });

  it("manual tweets include URL in metadata when provided", () => {
    const memories = formatManualTweets([
      { text: "Check this out", url: "https://twitter.com/user/status/12345" },
    ]);

    expect(memories).toHaveLength(1);
    expect(memories[0]?.metadata.url).toBe("https://twitter.com/user/status/12345");
  });

  it("manual tweets include author in metadata when provided", () => {
    const memories = formatManualTweets([
      { text: "A great thought", author: "Famous Person" },
    ]);

    expect(memories[0]?.metadata.author).toBe("Famous Person");
  });

  it("processArchiveImport returns correct total and valid counts", () => {
    const multiJs = `window.YTD.bookmark.part0 = [
      { "bookmark": { "tweetId": "1", "full_text": "Valid tweet one", "user": { "screen_name": "a" }, "entities": {} } },
      { "bookmark": { "tweetId": "2" } },
      { "bookmark": { "tweetId": "3", "full_text": "Valid tweet three", "user": { "screen_name": "b" }, "entities": {} } },
      { "bookmark": { "tweetId": "4" } }
    ];`;

    const result = processArchiveImport(multiJs);

    expect(result.total).toBe(4);
    expect(result.valid).toBe(2);
    expect(result.memories).toHaveLength(2);
  });

  it("formatTweetMemory title is bounded in length", () => {
    const longTweet: ParsedTweet = {
      id: "9999",
      text: "A".repeat(300),
      author: "Author",
      authorHandle: "handle",
    };

    const memory = formatTweetMemory(longTweet);

    // Title should be reasonable length (not 300+ chars)
    expect(memory.title.length).toBeLessThan(200);
  });
});
