/**
 * Domain-Specific Embeddings — Portable Logic
 *
 * Domain profiles, keyword-based domain detection, and model recommendations
 * for specialized knowledge areas (code, medical, legal, scientific, financial).
 *
 * Pure logic: no HTTP, no DB.
 */

// ─── Types ──────────────────────────────────────────────────────

export interface EmbeddingModel {
  name: string;
  provider: 'ollama' | 'openai' | 'huggingface' | 'cohere';
  model: string;
  dimensions: number;
  description: string;
  strengths: string[];
}

export interface DomainProfile {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  keywords: string[];
  recommendedModels: EmbeddingModel[];
}

export interface DomainDetectionResult {
  domain: string;
  score: number;
  matches: string[];
}

// ─── Domain Profiles ────────────────────────────────────────────

export const DOMAIN_PROFILES: DomainProfile[] = [
  {
    id: 'general',
    name: 'General',
    description: 'Default embedding model for general-purpose content.',
    icon: 'Box',
    color: 'teal',
    keywords: [],
    recommendedModels: [
      {
        name: 'OpenAI text-embedding-3-small',
        provider: 'openai',
        model: 'text-embedding-3-small',
        dimensions: 1536,
        description: 'Fast, cost-effective, high-quality general embeddings.',
        strengths: ['Fast', 'Low cost', 'Good accuracy', 'Wide language support'],
      },
      {
        name: 'Gemini text-embedding-004',
        provider: 'openai',
        model: 'text-embedding-004',
        dimensions: 768,
        description: "Google's latest embedding model. Free tier available.",
        strengths: ['Free tier', 'Good accuracy', 'Multilingual'],
      },
      {
        name: 'Nomic Embed Text (Ollama)',
        provider: 'ollama',
        model: 'nomic-embed-text',
        dimensions: 768,
        description: 'High-quality local embeddings. No API key needed.',
        strengths: ['Fully local', 'Privacy-first', 'No cost', 'Good quality'],
      },
    ],
  },
  {
    id: 'code',
    name: 'Code & Programming',
    description: 'Optimized for source code, documentation, APIs, and technical content.',
    icon: 'Code',
    color: 'sky',
    keywords: [
      'function', 'class', 'import', 'const', 'let', 'var', 'def', 'return',
      'async', 'await', 'interface', 'type', 'enum', 'struct', 'impl',
      'module', 'package', 'require', 'export', 'API', 'endpoint', 'REST',
      'GraphQL', 'SQL', 'query', 'database', 'algorithm', 'git', 'docker',
      'kubernetes', 'npm', 'pip',
    ],
    recommendedModels: [
      {
        name: 'Nomic Embed Code (Ollama)',
        provider: 'ollama',
        model: 'nomic-embed-text',
        dimensions: 768,
        description: 'Good for code when fine-tuned. Best local option.',
        strengths: ['Code-aware', 'Local', 'No cost'],
      },
      {
        name: 'OpenAI text-embedding-3-large',
        provider: 'openai',
        model: 'text-embedding-3-large',
        dimensions: 3072,
        description: 'Highest accuracy OpenAI model for nuanced code similarities.',
        strengths: ['Highest accuracy', 'Code-aware', 'Large dimensions'],
      },
    ],
  },
  {
    id: 'medical',
    name: 'Medical & Health',
    description: 'Specialized for medical literature, clinical notes, and health research.',
    icon: 'Heart',
    color: 'rose',
    keywords: [
      'patient', 'diagnosis', 'treatment', 'clinical', 'trial', 'drug',
      'symptom', 'disease', 'syndrome', 'therapy', 'medication', 'dosage',
      'prognosis', 'pathology', 'surgery', 'FDA', 'NIH', 'PubMed', 'PMID',
      'ICD', 'biomarker', 'enzyme', 'receptor', 'antibody', 'vaccine',
      'protocol', 'cohort',
    ],
    recommendedModels: [
      {
        name: 'PubMedBERT (Ollama)',
        provider: 'ollama',
        model: 'nomic-embed-text',
        dimensions: 768,
        description: 'Best available local model for medical content.',
        strengths: ['Medical terminology', 'Local', 'PubMed trained'],
      },
      {
        name: 'OpenAI text-embedding-3-large',
        provider: 'openai',
        model: 'text-embedding-3-large',
        dimensions: 3072,
        description: 'Handles medical terminology well with high dimensionality.',
        strengths: ['High accuracy', 'Good medical understanding'],
      },
    ],
  },
  {
    id: 'legal',
    name: 'Legal & Compliance',
    description: 'Optimized for legal documents, contracts, and regulations.',
    icon: 'Scale',
    color: 'amber',
    keywords: [
      'contract', 'clause', 'agreement', 'plaintiff', 'defendant', 'court',
      'judge', 'statute', 'regulation', 'compliance', 'litigation',
      'arbitration', 'jurisdiction', 'tort', 'liability', 'indemnity',
      'precedent', 'brief', 'motion', 'verdict', 'appeal', 'amendment',
      'ordinance', 'GDPR', 'CCPA', 'HIPAA', 'SEC', 'FTC',
    ],
    recommendedModels: [
      {
        name: 'Nomic Embed Text (Ollama)',
        provider: 'ollama',
        model: 'nomic-embed-text',
        dimensions: 768,
        description: 'General-purpose model — reasonable for legal text locally.',
        strengths: ['Local', 'No cost', 'Decent accuracy'],
      },
      {
        name: 'OpenAI text-embedding-3-large',
        provider: 'openai',
        model: 'text-embedding-3-large',
        dimensions: 3072,
        description: 'Best for legal nuance and complex text.',
        strengths: ['High accuracy', 'Handles complexity'],
      },
    ],
  },
  {
    id: 'scientific',
    name: 'Scientific Research',
    description: 'For academic papers, research notes, and scholarly content.',
    icon: 'FlaskConical',
    color: 'emerald',
    keywords: [
      'hypothesis', 'experiment', 'results', 'methodology', 'abstract',
      'conclusion', 'peer-reviewed', 'citation', 'journal', 'DOI', 'arxiv',
      'thesis', 'dissertation', 'coefficient', 'p-value', 'significance',
      'correlation', 'regression', 'dataset', 'sample', 'control',
      'variable', 'quantum', 'molecular', 'genome', 'neural', 'entropy',
    ],
    recommendedModels: [
      {
        name: 'Snowflake Arctic Embed (Ollama)',
        provider: 'ollama',
        model: 'snowflake-arctic-embed',
        dimensions: 1024,
        description: 'Strong retrieval model for technical and scientific content.',
        strengths: ['Retrieval-optimized', 'Local', 'Technical content'],
      },
      {
        name: 'OpenAI text-embedding-3-large',
        provider: 'openai',
        model: 'text-embedding-3-large',
        dimensions: 3072,
        description: 'Highest quality for scientific content.',
        strengths: ['Highest accuracy', 'Wide domain knowledge'],
      },
    ],
  },
  {
    id: 'financial',
    name: 'Finance & Business',
    description: 'For financial reports, market analysis, and business strategy.',
    icon: 'TrendingUp',
    color: 'sky',
    keywords: [
      'revenue', 'profit', 'margin', 'EBITDA', 'valuation', 'portfolio',
      'equity', 'bond', 'derivative', 'hedge', 'ROI', 'P/E', 'market cap',
      'IPO', 'SEC', 'quarterly', 'fiscal', 'cash flow', 'balance sheet',
      'income statement', 'dividend', 'yield', 'volatility', 'inflation',
      'GDP', 'Fed', 'stock', 'trading',
    ],
    recommendedModels: [
      {
        name: 'OpenAI text-embedding-3-small',
        provider: 'openai',
        model: 'text-embedding-3-small',
        dimensions: 1536,
        description: 'Good balance of cost and accuracy for financial content.',
        strengths: ['Good accuracy', 'Cost-effective', 'Financial terms'],
      },
      {
        name: 'Nomic Embed Text (Ollama)',
        provider: 'ollama',
        model: 'nomic-embed-text',
        dimensions: 768,
        description: 'Local option — privacy-first for sensitive financial data.',
        strengths: ['Local', 'Privacy-first', 'No data leaves device'],
      },
    ],
  },
];

// ─── Domain Detection ───────────────────────────────────────────

/**
 * Detect domains in a text based on keyword density.
 * Returns scored results sorted by confidence (highest first).
 */
export function detectDomain(text: string): DomainDetectionResult[] {
  const lower = text.toLowerCase();
  const words = lower.split(/\s+/);
  const wordSet = new Set(words);

  return DOMAIN_PROFILES.filter((d) => d.id !== 'general')
    .map((profile) => {
      const matches = profile.keywords.filter((kw) => {
        const kwLower = kw.toLowerCase();
        return wordSet.has(kwLower) || lower.includes(kwLower);
      });
      const score = matches.length / Math.max(profile.keywords.length, 1);
      return { domain: profile.id, score, matches };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
}

/**
 * Get the primary domain for a text.
 * Returns 'general' if no domain exceeds the threshold.
 */
export function primaryDomain(
  text: string,
  threshold: number = 0.05,
): DomainDetectionResult {
  const results = detectDomain(text);
  if (results.length > 0 && results[0].score > threshold) {
    return results[0];
  }
  return { domain: 'general', score: 1, matches: [] };
}

/**
 * Get a DomainProfile by ID. Returns general if not found.
 */
export function getDomainProfile(domainId: string): DomainProfile {
  return (
    DOMAIN_PROFILES.find((d) => d.id === domainId) ||
    DOMAIN_PROFILES.find((d) => d.id === 'general')!
  );
}

/**
 * Filter embedding models for a domain by available providers.
 */
export function availableModelsForDomain(
  domainId: string,
  providers: { openai: boolean; ollama: boolean; huggingface?: boolean },
): EmbeddingModel[] {
  const profile = getDomainProfile(domainId);
  return profile.recommendedModels.filter(
    (m) =>
      (m.provider === 'openai' && providers.openai) ||
      (m.provider === 'ollama' && providers.ollama) ||
      (m.provider === 'huggingface' && providers.huggingface),
  );
}
