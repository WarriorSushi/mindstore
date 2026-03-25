import { describe, expect, it } from "vitest";
import {
  parseSpotifyData,
  buildMusicProfile,
  formatArtistContent,
  formatMonthlyListening,
} from "@/server/plugins/ports/spotify-importer";

const SAMPLE_STREAMS = JSON.stringify([
  { artistName: "Radiohead", trackName: "Creep", msPlayed: 240000, endTime: "2024-01-15 10:00" },
  { artistName: "Radiohead", trackName: "Creep", msPlayed: 240000, endTime: "2024-01-15 11:00" },
  { artistName: "Radiohead", trackName: "Karma Police", msPlayed: 300000, endTime: "2024-01-15 12:00" },
  { artistName: "Tame Impala", trackName: "Let It Happen", msPlayed: 450000, endTime: "2024-02-10 09:00" },
  { artistName: "Tame Impala", trackName: "The Less I Know", msPlayed: 200000, endTime: "2024-02-10 10:00" },
  { artistName: "Skipped Artist", trackName: "Too Short", msPlayed: 5000, endTime: "2024-03-01 08:00" },
]);

describe("spotify importer port", () => {
  it("parses streaming history JSON", () => {
    const streams = parseSpotifyData(SAMPLE_STREAMS);

    expect(streams).toHaveLength(6);
    expect(streams[0]?.artistName).toBe("Radiohead");
    expect(streams[0]?.trackName).toBe("Creep");
    expect(streams[0]?.msPlayed).toBe(240000);
  });

  it("builds a music profile, filtering short plays (<30s)", () => {
    const streams = parseSpotifyData(SAMPLE_STREAMS);
    const profile = buildMusicProfile(streams);

    // 5 valid streams (one is only 5s and should be filtered)
    expect(profile.uniqueArtists).toBe(2); // Skipped Artist has no valid plays
    expect(profile.uniqueTracks).toBe(4); // Creep, Karma Police, Let It Happen, The Less I Know
    expect(profile.topArtists).toHaveLength(2);
    expect(profile.topArtists[0]?.name).toBe("Radiohead"); // most listening time
    expect(profile.topArtists[0]?.trackCount).toBe(2);
    expect(profile.tasteProfile).toContain("Radiohead");
  });

  it("tracks monthly listening", () => {
    const streams = parseSpotifyData(SAMPLE_STREAMS);
    const profile = buildMusicProfile(streams);

    expect(profile.listeningByMonth["2024-01"]).toBeDefined();
    expect(profile.listeningByMonth["2024-02"]).toBeDefined();
    // March stream was too short, so not counted
    expect(profile.listeningByMonth["2024-03"]).toBeUndefined();
  });

  it("formats artist content", () => {
    const streams = parseSpotifyData(SAMPLE_STREAMS);
    const profile = buildMusicProfile(streams);
    const content = formatArtistContent(profile.topArtists[0]!);

    expect(content).toContain("Radiohead");
    expect(content).toContain("Creep");
  });

  it("formats monthly listening", () => {
    const streams = parseSpotifyData(SAMPLE_STREAMS);
    const profile = buildMusicProfile(streams);
    const content = formatMonthlyListening(profile.listeningByMonth);

    expect(content).toContain("2024-01");
    expect(content).toContain("hours");
  });
});
