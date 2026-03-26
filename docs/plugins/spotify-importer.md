# Spotify Listening History

Import your Spotify streaming history and build a music taste profile.

## What It Does

- Parses Spotify streaming history JSON (both standard and extended format)
- Filters out short plays (<30 seconds)
- Builds a comprehensive music taste profile:
  - Top artists with play counts and listening time
  - Most played tracks per artist
  - Monthly listening patterns
  - Overall taste summary
- Replaces previous Spotify import on each new import (fresh data)
- Ask "What kind of music do I like?" in MindStore chat

## How To Use It

1. Go to spotify.com → Account → Privacy
2. Click "Request data" under "Download your data"
3. Wait for Spotify email (5-30 days)
4. Download and unzip the file
5. Upload StreamingHistory_music_0.json (or similar)

## Port Architecture

- Parsing + profile builder in `src/server/plugins/ports/spotify-importer.ts`
- Thin API route at `src/app/api/v1/plugins/spotify-importer/route.ts`
- Import storage via `import-service.ts`
- Test at `tests/unit/spotify-importer.test.ts`
