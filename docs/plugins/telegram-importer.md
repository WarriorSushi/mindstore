# Telegram Messages

Import Telegram saved messages and channel history from data exports.

## What It Does

- Parses Telegram Desktop JSON exports (result.json)
- Handles both single-chat and full-account exports
- Extracts rich text (bold, italic, code, links, mentions)
- Groups sequential messages from the same sender within 5 minutes
- Supports filtering by chat type (saved messages, private, groups, channels)
- Configurable minimum message length

## How To Use It

1. Open Telegram Desktop (not mobile)
2. Go to Settings → Advanced → Export Telegram Data
3. Select chats/channels to export
4. Choose "Machine-readable JSON" format
5. Upload the result.json file in MindStore's import tab

## Port Architecture

- Parsing logic in `src/server/plugins/ports/telegram-importer.ts`
- Thin API route at `src/app/api/v1/plugins/telegram-importer/route.ts`
- Import storage via `import-service.ts`
- Test at `tests/unit/telegram-importer.test.ts`
