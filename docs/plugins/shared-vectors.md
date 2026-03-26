# Shared Vectors (Utility Module)

`shared-vectors.ts` provides embedding math, clustering, and text analysis utilities used across multiple analysis plugins (topic-evolution, knowledge-gaps, mind-map-generator, etc.).

## What It Does

### Embedding Operations
- **parseEmbedding** — safely parses embeddings from arrays, JSON strings, or DB columns
- **cosineSimilarity** — standard cosine similarity between two vectors

### Clustering
- **kMeansClustering** — k-means++ initialization with cosine distance, configurable iterations
- **computeCoherence** — average cosine similarity of cluster members to centroid

### Text Analysis
- **extractKeywords** — TF-IDF keyword extraction with 200+ stop words filtered
- **extractTopicLabel** — generates readable topic labels from dominant source titles or keywords
- **countSourceTypes** — frequency count of source types in a collection

## Location

`src/server/plugins/ports/shared-vectors.ts`

## Usage Pattern

```ts
import { parseEmbedding, kMeansClustering, extractTopicLabel } from './shared-vectors';

// Parse embeddings from DB
const memories = rows.map(r => ({
  ...r,
  embedding: parseEmbedding(r.embedding),
}));

// Cluster into topics
const clusters = kMeansClustering(memories, 8, 20);

// Label each cluster
const topics = clusters.map(c => ({
  label: extractTopicLabel(c.members),
  count: c.members.length,
  coherence: c.coherence,
}));
```

## Tests

`tests/unit/shared-vectors.test.ts` — 25 tests covering parsing, similarity, clustering, keyword extraction, topic labeling, and source counting.
