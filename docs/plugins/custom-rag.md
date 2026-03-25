# Custom RAG Strategies Plugin

Swappable retrieval-augmented generation strategies for MindStore's knowledge base search.

## Category
AI Enhancement

## Strategies

| Strategy | Description | Latency | Accuracy |
|----------|-------------|---------|----------|
| **Default** | BM25 + Vector + Tree with RRF fusion | ~200ms | Good |
| **HyDE** | AI generates hypothetical answer, embeds that for retrieval | ~1-3s | Very Good |
| **Multi-Query** | Expands query into 3 perspectives, searches each, merges | ~1-2s | Good (broader) |
| **Reranking** | Retrieves larger set, AI reranks by relevance | ~2-4s | Excellent |
| **Contextual Compression** | AI extracts only relevant sentences from results | ~3-5s | Good (focused) |
| **Maximal** | HyDE + Multi-Query + Reranking combined | ~5-10s | Maximum |

## API

### GET `/api/v1/plugins/custom-rag`

| Action      | Params      | Description                              |
|-------------|-------------|------------------------------------------|
| `config`    | —           | Current strategy + available strategies  |
| `stats`     | —           | Memory/embedding/tree counts             |
| `benchmark` | `q` (query) | Compare default vs HyDE on same query    |

### POST `/api/v1/plugins/custom-rag`

| Action        | Body                                          | Description                    |
|---------------|-----------------------------------------------|--------------------------------|
| `save-config` | `strategy`, `enabledLayers`, `rrfK`, etc.    | Save strategy configuration    |
| `test-query`  | `query`, `strategy`                           | Test query with specific strategy |

## Architecture
- All strategy logic is pure functions with injected dependencies (callAI, embed, retrieve)
- No direct DB or HTTP calls in portable logic
- AI provider auto-detected from settings (OpenAI → Gemini → OpenRouter)
- Default strategy requires no AI calls; advanced strategies need an AI provider

## Dependencies
- Requires at least one AI provider for strategies beyond "default"
- Uses existing retrieval infrastructure (BM25 + Vector + Tree)
