const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "is", "are", "was", "were",
  "be", "been", "being", "have", "has", "had", "do", "does", "did",
  "will", "would", "could", "should", "may", "might", "shall", "can",
  "to", "of", "in", "for", "on", "with", "at", "by", "from", "about",
  "as", "into", "through", "during", "before", "after", "above", "below",
  "between", "under", "over", "then", "than", "so", "no", "not", "only",
  "very", "just", "also", "more", "most", "other", "some", "such", "any",
  "each", "every", "all", "both", "few", "many", "much", "own", "same",
  "this", "that", "these", "those", "it", "its", "i", "me", "my", "we",
  "us", "our", "you", "your", "he", "his", "she", "her", "they", "them",
  "their", "what", "which", "who", "whom", "when", "where", "why", "how",
  "if", "because", "while", "although", "though", "since", "until",
  "like", "well", "back", "even", "still", "already", "really", "here",
  "there", "now", "up", "out", "way", "new", "one", "two", "first",
  "last", "next", "good", "great", "make", "think", "know", "get",
  "see", "come", "go", "want", "use", "find", "give", "tell", "work",
  "say", "take", "need", "look", "try", "ask", "let", "keep", "help",
  "start", "show", "set", "put", "end", "another", "something", "things",
  "thing", "people", "time", "year", "years", "day", "days", "part",
  "long", "used", "able", "using", "different", "however", "example",
  "based", "important", "actually", "often", "going", "right", "sure",
  "point", "always",
]);

export interface EmbeddedMemoryLike {
  id: string;
  content: string;
  sourceType: string;
  sourceTitle: string;
  embedding: number[];
  createdAt: string;
}

export interface VectorCluster<T extends { embedding: number[] }> {
  centroid: number[];
  members: T[];
  coherence: number;
}

export function parseEmbedding(raw: unknown): number[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.filter((value): value is number => typeof value === "number");
  }
  if (typeof raw === "string") {
    try {
      const cleaned = raw.replace(/^\[/, "").replace(/\]$/, "");
      return cleaned.split(",").map((value) => Number.parseFloat(value)).filter(Number.isFinite);
    } catch {
      return [];
    }
  }
  return [];
}

export function cosineSimilarity(left: number[], right: number[]) {
  if (left.length !== right.length || left.length === 0) {
    return 0;
  }

  let dot = 0;
  let normLeft = 0;
  let normRight = 0;

  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index] || 0;
    const rightValue = right[index] || 0;
    dot += leftValue * rightValue;
    normLeft += leftValue * leftValue;
    normRight += rightValue * rightValue;
  }

  const denominator = Math.sqrt(normLeft) * Math.sqrt(normRight);
  return denominator > 0 ? dot / denominator : 0;
}

export function kMeansClustering<T extends { embedding: number[] }>(
  items: T[],
  k: number,
  iterations: number,
): Array<VectorCluster<T>> {
  if (!items.length) {
    return [];
  }

  if (items.length <= k) {
    return items.map((item) => ({
      centroid: [...item.embedding],
      members: [item],
      coherence: 1,
    }));
  }

  const dimension = items[0]?.embedding.length || 0;
  const centroids: number[][] = [];
  const firstIndex = Math.floor(Math.random() * items.length);
  centroids.push([...(items[firstIndex]?.embedding || [])]);

  for (let clusterIndex = 1; clusterIndex < k; clusterIndex += 1) {
    const distances = items.map((item) => {
      const minDistance = centroids.reduce((min, centroid) => {
        const similarity = cosineSimilarity(item.embedding, centroid);
        return Math.min(min, 1 - similarity);
      }, Infinity);
      return minDistance * minDistance;
    });

    const totalDistance = distances.reduce((sum, value) => sum + value, 0);
    if (!totalDistance) {
      break;
    }

    let threshold = Math.random() * totalDistance;
    let chosenIndex = 0;
    for (let index = 0; index < distances.length; index += 1) {
      threshold -= distances[index] || 0;
      if (threshold <= 0) {
        chosenIndex = index;
        break;
      }
    }

    centroids.push([...(items[chosenIndex]?.embedding || [])]);
  }

  let assignments = new Array(items.length).fill(0);

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const nextAssignments = items.map((item) => {
      let bestCluster = 0;
      let bestSimilarity = -Infinity;

      for (let clusterIndex = 0; clusterIndex < centroids.length; clusterIndex += 1) {
        const similarity = cosineSimilarity(item.embedding, centroids[clusterIndex] || []);
        if (similarity > bestSimilarity) {
          bestSimilarity = similarity;
          bestCluster = clusterIndex;
        }
      }

      return bestCluster;
    });

    const changed = nextAssignments.some((assignment, index) => assignment !== assignments[index]);
    assignments = nextAssignments;
    if (!changed) {
      break;
    }

    for (let clusterIndex = 0; clusterIndex < centroids.length; clusterIndex += 1) {
      const members = items.filter((_, index) => assignments[index] === clusterIndex);
      if (!members.length) {
        continue;
      }

      const nextCentroid = new Array(dimension).fill(0);
      for (const member of members) {
        for (let dim = 0; dim < dimension; dim += 1) {
          nextCentroid[dim] += member.embedding[dim] || 0;
        }
      }

      for (let dim = 0; dim < dimension; dim += 1) {
        nextCentroid[dim] /= members.length;
      }

      centroids[clusterIndex] = nextCentroid;
    }
  }

  return centroids
    .map((centroid, clusterIndex) => {
      const members = items.filter((_, index) => assignments[index] === clusterIndex);
      return {
        centroid,
        members,
        coherence: computeCoherence(centroid, members),
      };
    })
    .filter((cluster) => cluster.members.length > 0);
}

export function computeCoherence<T extends { embedding: number[] }>(centroid: number[], members: T[]) {
  if (members.length <= 1) {
    return 1;
  }

  const similarities = members.map((member) => cosineSimilarity(centroid, member.embedding));
  return round(similarities.reduce((sum, value) => sum + value, 0) / similarities.length, 2);
}

export function extractKeywords<T extends { content: string }>(items: T[], count: number) {
  const wordCounts: Record<string, number> = {};
  const documentCounts: Record<string, number> = {};

  for (const item of items) {
    const words = item.content
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .split(/\s+/)
      .filter((word) => word.length > 2 && !STOP_WORDS.has(word));

    const seen = new Set<string>();
    for (const word of words) {
      wordCounts[word] = (wordCounts[word] || 0) + 1;
      if (!seen.has(word)) {
        documentCounts[word] = (documentCounts[word] || 0) + 1;
        seen.add(word);
      }
    }
  }

  return Object.entries(wordCounts)
    .filter(([, frequency]) => frequency >= 2)
    .map(([word, frequency]) => {
      const documentFrequency = documentCounts[word] || 1;
      const inverseFrequency = Math.log(items.length / documentFrequency) + 1;
      return { word, score: frequency * inverseFrequency };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, count)
    .map((entry) => entry.word);
}

export function extractTopicLabel<T extends { content: string; sourceTitle: string }>(items: T[]) {
  const sourceCounts: Record<string, number> = {};

  for (const item of items) {
    sourceCounts[item.sourceTitle] = (sourceCounts[item.sourceTitle] || 0) + 1;
  }

  const topSource = Object.entries(sourceCounts).sort((left, right) => right[1] - left[1])[0];
  if (topSource && topSource[1] / items.length > 0.6) {
    const title = topSource[0];
    if (title && title !== "Untitled" && title.length <= 40) {
      return title;
    }
  }

  const keywords = extractKeywords(items, 3);
  if (keywords.length > 0) {
    return keywords
      .slice(0, 2)
      .map((keyword) => keyword.charAt(0).toUpperCase() + keyword.slice(1))
      .join(" & ");
  }

  return `Topic ${Math.floor(Math.random() * 100)}`;
}

export function countSourceTypes<T extends { sourceType: string }>(items: T[]) {
  const counts: Record<string, number> = {};
  for (const item of items) {
    counts[item.sourceType] = (counts[item.sourceType] || 0) + 1;
  }
  return counts;
}

function round(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
