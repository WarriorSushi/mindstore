import { describe, expect, it } from "vitest";
import {
  parseSpotifyData,
  buildMusicProfile,
  formatArtistContent,
  formatMonthlyListening,
  buildImportDocuments,
  type SpotifyStream,
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

  it("calculates total listening time in milliseconds", () => {
    const streams = parseSpotifyData(SAMPLE_STREAMS);
    const profile = buildMusicProfile(streams);

    // Total of valid streams (excluding 5000ms skip): 240000 + 240000 + 300000 + 450000 + 200000 = 1430000
    expect(profile.totalListeningMs).toBe(1430000);
  });

  it("ranks top artists by total listening time", () => {
    const streams = parseSpotifyData(SAMPLE_STREAMS);
    const profile = buildMusicProfile(streams);

    // Radiohead: 240000 + 240000 + 300000 = 780000
    // Tame Impala: 450000 + 200000 = 650000
    expect(profile.topArtists[0]?.name).toBe("Radiohead");
    expect(profile.topArtists[1]?.name).toBe("Tame Impala");
    expect(profile.topArtists[0]?.totalMs).toBe(780000);
    expect(profile.topArtists[1]?.totalMs).toBe(650000);
  });

  it("handles empty streaming data", () => {
    const streams = parseSpotifyData("[]");
    const profile = buildMusicProfile(streams);

    expect(profile.uniqueArtists).toBe(0);
    expect(profile.uniqueTracks).toBe(0);
    expect(profile.topArtists).toHaveLength(0);
    expect(profile.totalListeningMs).toBe(0);
  });

  it("handles all-skipped data (everything under 30s)", () => {
    const shortStreams = JSON.stringify([
      { artistName: "A", trackName: "Skip1", msPlayed: 5000, endTime: "2024-01-01 10:00" },
      { artistName: "B", trackName: "Skip2", msPlayed: 10000, endTime: "2024-01-01 11:00" },
    ]);

    const streams = parseSpotifyData(shortStreams);
    const profile = buildMusicProfile(streams);

    expect(profile.uniqueArtists).toBe(0);
    expect(profile.uniqueTracks).toBe(0);
    expect(profile.totalListeningMs).toBe(0);
  });

  it("buildImportDocuments creates taste profile document", () => {
    const streams = parseSpotifyData(SAMPLE_STREAMS);
    const profile = buildMusicProfile(streams);
    const docs = buildImportDocuments(profile);

    const tasteDoc = docs.find(d => d.metadata.type === "taste-profile");
    expect(tasteDoc).toBeDefined();
    expect(tasteDoc!.title).toBe("My Music Taste Profile");
    expect(tasteDoc!.sourceType).toBe("spotify");
    expect(tasteDoc!.metadata.importedVia).toBe("spotify-importer-plugin");
  });

  it("buildImportDocuments creates artist profile documents", () => {
    const streams = parseSpotifyData(SAMPLE_STREAMS);
    const profile = buildMusicProfile(streams);
    const docs = buildImportDocuments(profile);

    const artistDocs = docs.filter(d => d.metadata.type === "artist-profile");
    expect(artistDocs).toHaveLength(2); // Radiohead and Tame Impala
    expect(artistDocs[0]?.title).toBe("Artist: Radiohead");
    expect(artistDocs[1]?.title).toBe("Artist: Tame Impala");
  });

  it("buildImportDocuments creates monthly listening document", () => {
    const streams = parseSpotifyData(SAMPLE_STREAMS);
    const profile = buildMusicProfile(streams);
    const docs = buildImportDocuments(profile);

    const monthlyDoc = docs.find(d => d.metadata.type === "monthly-summary");
    expect(monthlyDoc).toBeDefined();
    expect(monthlyDoc!.title).toBe("Monthly Listening History");
  });

  it("buildImportDocuments limits artist profiles to 20", () => {
    // Create streams for 25 different artists
    const manyArtists = [];
    for (let i = 0; i < 25; i++) {
      manyArtists.push({
        artistName: `Artist ${i}`,
        trackName: `Track ${i}`,
        msPlayed: 60000 * (25 - i), // varied listening time
        endTime: "2024-01-01 10:00",
      });
    }

    const streams = parseSpotifyData(JSON.stringify(manyArtists));
    const profile = buildMusicProfile(streams);
    const docs = buildImportDocuments(profile);

    const artistDocs = docs.filter(d => d.metadata.type === "artist-profile");
    expect(artistDocs.length).toBeLessThanOrEqual(20);
  });

  it("tracks unique track count correctly with repeat plays", () => {
    const streams = parseSpotifyData(SAMPLE_STREAMS);
    const profile = buildMusicProfile(streams);

    // Creep played 2x but should only count as 1 unique track
    // Creep, Karma Police, Let It Happen, The Less I Know = 4
    expect(profile.uniqueTracks).toBe(4);
  });
});
