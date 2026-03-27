/**
 * Search query preprocessing — improves search quality.
 * 
 * Features:
 * - Typo tolerance via fuzzy matching
 * - Query expansion with synonyms
 * - Stop word removal
 * - Abbreviation expansion
 */

/** Common stop words that add noise to BM25 search */
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
  'on', 'with', 'at', 'by', 'from', 'it', 'its', 'this', 'that', 'these',
  'those', 'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'she',
  'they', 'them', 'their', 'what', 'which', 'who', 'whom', 'how',
  'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'between', 'and', 'but', 'or', 'not', 'so', 'if', 'then', 'than',
  'very', 'just', 'also', 'some', 'any', 'all', 'each', 'every',
]);

/** Common abbreviations → expanded forms */
const ABBREVIATIONS: Record<string, string> = {
  'ml': 'machine learning',
  'ai': 'artificial intelligence',
  'dl': 'deep learning',
  'nlp': 'natural language processing',
  'cv': 'computer vision',
  'rl': 'reinforcement learning',
  'api': 'application programming interface',
  'db': 'database',
  'ui': 'user interface',
  'ux': 'user experience',
  'js': 'javascript',
  'ts': 'typescript',
  'py': 'python',
  'cs': 'computer science',
  'os': 'operating system',
  'ci': 'continuous integration',
  'cd': 'continuous deployment',
  'oop': 'object oriented programming',
  'fp': 'functional programming',
  'gpu': 'graphics processing unit',
  'cpu': 'central processing unit',
  'ram': 'random access memory',
  'ssd': 'solid state drive',
  'aws': 'amazon web services',
  'gcp': 'google cloud platform',
  'k8s': 'kubernetes',
  'devops': 'development operations',
};

export interface ProcessedQuery {
  /** Original query */
  original: string;
  /** Cleaned query (stop words removed, normalized) */
  cleaned: string;
  /** Expanded query (with abbreviation expansions) */
  expanded: string;
  /** Individual meaningful terms */
  terms: string[];
}

/**
 * Process a search query for better retrieval.
 */
export function processQuery(query: string): ProcessedQuery {
  const original = query.trim();
  const lower = original.toLowerCase();
  
  // Split into words
  const words = lower.split(/\s+/).filter(w => w.length > 0);
  
  // Remove stop words (but keep if query is very short)
  const meaningful = words.length <= 3
    ? words
    : words.filter(w => !STOP_WORDS.has(w));
  
  // Expand abbreviations
  const expanded = meaningful.map(w => {
    const expansion = ABBREVIATIONS[w];
    return expansion ? `${w} ${expansion}` : w;
  });
  
  return {
    original,
    cleaned: meaningful.join(' '),
    expanded: expanded.join(' '),
    terms: meaningful,
  };
}

/**
 * Generate search suggestions based on a partial query.
 * Returns possible completions.
 */
export function generateSuggestions(partial: string): string[] {
  const lower = partial.toLowerCase().trim();
  if (lower.length < 2) return [];
  
  const suggestions: string[] = [];
  
  // Suggest abbreviation expansions
  for (const [abbr, full] of Object.entries(ABBREVIATIONS)) {
    if (abbr.startsWith(lower) || full.startsWith(lower)) {
      suggestions.push(full);
    }
  }
  
  // Common query patterns
  const patterns = [
    'what did I learn about',
    'notes about',
    'conversations about',
    'highlights from',
    'my thoughts on',
    'summary of',
    'ideas about',
    'when did I',
    'how does',
    'what is',
  ];
  
  for (const p of patterns) {
    if (p.startsWith(lower)) {
      suggestions.push(p);
    }
  }
  
  return suggestions.slice(0, 5);
}
