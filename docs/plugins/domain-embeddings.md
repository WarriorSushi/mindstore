# Domain-Specific Embeddings Plugin

Detects the knowledge domain of your memories and recommends optimized embedding models for each domain.

## Category
AI Enhancement

## Domains

| Domain | Icon | Keywords | Example Models |
|--------|------|----------|----------------|
| **General** | Box | — | text-embedding-3-small, nomic-embed-text |
| **Code** | Code | function, class, import, API... | nomic-embed-text, text-embedding-3-large |
| **Medical** | Heart | patient, diagnosis, treatment... | PubMedBERT, text-embedding-3-large |
| **Legal** | Scale | contract, clause, jurisdiction... | nomic-embed-text, text-embedding-3-large |
| **Scientific** | FlaskConical | hypothesis, experiment, p-value... | snowflake-arctic-embed, text-embedding-3-large |
| **Financial** | TrendingUp | revenue, EBITDA, portfolio... | text-embedding-3-small, nomic-embed-text |

## API

### GET `/api/v1/plugins/domain-embeddings`

| Action   | Params                | Description                          |
|----------|-----------------------|--------------------------------------|
| `config` | —                     | Domain profiles + provider status    |
| `stats`  | —                     | Domain distribution of memories      |
| `detect` | `text` (required)     | Detect domain for given text         |
| `models` | `domain` (required)   | Available models for a domain        |

### POST `/api/v1/plugins/domain-embeddings`

| Action         | Body                                    | Description                      |
|----------------|-----------------------------------------|----------------------------------|
| `save-config`  | `domainModels`, `autoDetect`, etc.     | Save domain model configuration  |
| `tag-domain`   | `memoryId`, `domain`                   | Tag a memory with a domain       |
| `batch-detect` | `batchSize` (default: 100)             | Auto-detect domains for untagged |

## Detection
- Keyword-based heuristic matching against domain keyword lists
- Score = matched keywords / total domain keywords
- Threshold: 5% match required to assign a domain
- Falls back to "general" for generic content

## Dependencies
- Provider availability checked dynamically (OpenAI, Gemini, Ollama)
- No external API calls for detection (pure keyword matching)
