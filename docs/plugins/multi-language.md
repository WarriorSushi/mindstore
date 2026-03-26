# Multi-Language Support Plugin

Language detection, script analysis, translation, and cross-language search for MindStore.

## Category
AI Enhancement

## Capabilities
- **Script Detection**: Identifies Unicode scripts (Latin, Cyrillic, Arabic, CJK, Hangul, Devanagari, etc.)
- **Heuristic Language Detection**: High confidence for non-Latin scripts; low confidence for Latin (needs AI)
- **AI Language Detection**: Precise detection via AI providers
- **Translation**: Memory content and search query translation
- **Cross-Language Search**: Translates queries to all detected languages, searches each, merges results
- **Batch Tagging**: Auto-detect and tag languages for untagged memories

## Supported Languages
50+ languages including English, Spanish, French, German, Japanese, Chinese, Korean, Arabic, Hindi, Russian, and many more.

## API

### GET `/api/v1/plugins/multi-language`

| Action      | Params                                | Description                          |
|-------------|---------------------------------------|--------------------------------------|
| `stats`     | —                                     | Language distribution of memories    |
| `check`     | —                                     | Feature availability (AI status)     |
| `detect`    | `text` (required)                     | Detect language of text              |
| `translate` | `text`, `from` (auto), `to` (en)     | Translate text between languages     |
| `search`    | `q`, `limit` (10)                     | Cross-language search                |

### POST `/api/v1/plugins/multi-language`

| Action        | Body                              | Description                        |
|---------------|-----------------------------------|------------------------------------|
| `tag`         | `memoryId`                        | Detect & tag language for 1 memory |
| `batch-tag`   | `batchSize` (50)                  | Auto-tag untagged memories         |
| `translate`   | `memoryId`, `targetLang`          | Translate a memory's content       |
| `save-config` | `autoDetect`, `preferredLanguage` | Save language preferences          |

## Detection Pipeline
1. **Script analysis** (Unicode ranges) — instant, no API
2. **Non-Latin script** → high confidence heuristic mapping (Cyrillic→Russian, Hangul→Korean, etc.)
3. **Latin script** → low confidence; falls back to AI if available
4. **AI detection** → JSON response with code, name, confidence

## Dependencies
- Script detection: no dependencies (pure Unicode analysis)
- AI detection/translation: requires OpenAI, Gemini, or OpenRouter API key
- Cross-language search: requires AI provider + PostgreSQL full-text search
