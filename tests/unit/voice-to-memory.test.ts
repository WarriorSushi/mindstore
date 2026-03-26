import { describe, expect, it } from "vitest";
import { generateVoiceRecordingTitle } from "@/server/plugins/ports/voice-to-memory";

describe("voice-to-memory port helpers", () => {
  it("creates a human title from the first sentence", () => {
    const title = generateVoiceRecordingTitle("Ship the plugin runtime first. Then layer in more ports.");

    expect(title).toBe("Ship the plugin runtime first");
  });

  it("falls back for inaudible recordings", () => {
    expect(generateVoiceRecordingTitle("[inaudible]")).toBe("Voice Recording");
  });

  it("truncates long titles at a word boundary", () => {
    const title = generateVoiceRecordingTitle(
      "This is a much longer thought that should be shortened into a stable title for the recording because it keeps going.",
    );

    expect(title.length).toBeLessThanOrEqual(60);
    expect(title.endsWith("...")).toBe(true);
  });
});
