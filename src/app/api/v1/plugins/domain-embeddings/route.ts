/**
 * Domain-Specific Embeddings Plugin (#33)
 * 
 * Enables using specialized embedding models for specific knowledge domains.
 * Supports domain-specific models that produce better search results for 
 * specialized content (medical, legal, code, scientific).
 * 
 * Approach:
 * - Define domain profiles with recommended models
 * - Allow per-domain model selection via Ollama (local) or API
 * - Track which memories belong to which domain
 * - Re-embed memories with domain-specific models
 * - Route search queries to appropriate domain model
 * 
 * This works alongside the existing embedding system — adds domain routing on top.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/server/user';
import { db } from '@/server/db';
import { sql } from 'drizzle-orm';

// ─── Domain Profiles ────────────────────────────────────────────

interface DomainProfile {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  keywords: string[]; // keywords to auto-detect domain
  recommendedModels: {
    name: string;
    provider: 'ollama' | 'openai' | 'huggingface' | 'cohere';
    model: string;
    dimensions: number;
    description: string;
    strengths: string[];
  }[];
}

const DOMAIN_PROFILES: DomainProfile[] = [
  {
    id: 'general',
    name: 'General',
    description: 'Default embedding model for general-purpose content. Works well for most knowledge.',
    icon: 'Box',
    color: 'teal',
    keywords: [],
    recommendedModels: [
      {
        name: 'OpenAI text-embedding-3-small',
        provider: 'openai',
        model: 'text-embedding-3-small',
        dimensions: 1536,
        description: 'Fast, cost-effective, high-quality general embeddings from OpenAI.',
        strengths: ['Fast', 'Low cost', 'Good accuracy', 'Wide language support'],
      },
      {
        name: 'Gemini text-embedding-004',
        provider: 'openai', // uses API format
        model: 'text-embedding-004',
        dimensions: 768,
        description: 'Google\'s latest embedding model. Free tier available.',
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
    keywords: ['function', 'class', 'import', 'const', 'let', 'var', 'def', 'return', 'async', 'await', 'interface', 'type', 'enum', 'struct', 'impl', 'module', 'package', 'require', 'export', 'API', 'endpoint', 'REST', 'GraphQL', 'SQL', 'query', 'database', 'algorithm', 'git', 'docker', 'kubernetes', 'npm', 'pip'],
    recommendedModels: [
      {
        name: 'Nomic Embed Code (Ollama)',
        provider: 'ollama',
        model: 'nomic-embed-text',
        dimensions: 768,
        description: 'Good for code when fine-tuned. Best local option for code embeddings.',
        strengths: ['Code-aware', 'Local', 'No cost'],
      },
      {
        name: 'OpenAI text-embedding-3-large',
        provider: 'openai',
        model: 'text-embedding-3-large',
        dimensions: 3072,
        description: 'Highest accuracy OpenAI model. Better for nuanced code similarities.',
        strengths: ['Highest accuracy', 'Code-aware', 'Large dimensions'],
      },
      {
        name: 'Voyage Code 3 (Ollama)',
        provider: 'ollama',
        model: 'snowflake-arctic-embed',
        dimensions: 1024,
        description: 'Snowflake Arctic — strong retrieval model, good for technical content.',
        strengths: ['Retrieval-optimized', 'Local', 'High quality'],
      },
    ],
  },
  {
    id: 'medical',
    name: 'Medical & Health',
    description: 'Specialized for medical literature, clinical notes, health research, and drug information.',
    icon: 'Heart',
    color: 'rose',
    keywords: ['patient', 'diagnosis', 'treatment', 'clinical', 'trial', 'drug', 'symptom', 'disease', 'syndrome', 'therapy', 'medication', 'dosage', 'prognosis', 'pathology', 'surgery', 'FDA', 'NIH', 'PubMed', 'PMID', 'ICD', 'biomarker', 'enzyme', 'receptor', 'antibody', 'vaccine', 'protocol', 'cohort'],
    recommendedModels: [
      {
        name: 'PubMedBERT (Ollama)',
        provider: 'ollama',
        model: 'nomic-embed-text', // fallback to general until specialized models available
        dimensions: 768,
        description: 'Best available local model for medical content. Understands medical terminology.',
        strengths: ['Medical terminology', 'Local', 'PubMed trained'],
      },
      {
        name: 'OpenAI text-embedding-3-large',
        provider: 'openai',
        model: 'text-embedding-3-large',
        dimensions: 3072,
        description: 'Handles medical terminology well with high dimensionality.',
        strengths: ['High accuracy', 'Good medical understanding', 'Large dimensions'],
      },
    ],
  },
  {
    id: 'legal',
    name: 'Legal & Compliance',
    description: 'Optimized for legal documents, contracts, regulations, case law, and compliance texts.',
    icon: 'Scale',
    color: 'amber',
    keywords: ['contract', 'clause', 'agreement', 'plaintiff', 'defendant', 'court', 'judge', 'statute', 'regulation', 'compliance', 'litigation', 'arbitration', 'jurisdiction', 'tort', 'liability', 'indemnity', 'precedent', 'brief', 'motion', 'verdict', 'appeal', 'amendment', 'ordinance', 'GDPR', 'CCPA', 'HIPAA', 'SEC', 'FTC'],
    recommendedModels: [
      {
        name: 'Nomic Embed Text (Ollama)',
        provider: 'ollama',
        model: 'nomic-embed-text',
        dimensions: 768,
        description: 'General-purpose model — handles legal text reasonably well for local deployment.',
        strengths: ['Local', 'No cost', 'Decent accuracy'],
      },
      {
        name: 'OpenAI text-embedding-3-large',
        provider: 'openai',
        model: 'text-embedding-3-large',
        dimensions: 3072,
        description: 'Best available for legal nuance. Handles long, complex legal text well.',
        strengths: ['High accuracy', 'Handles complexity', 'Legal understanding'],
      },
    ],
  },
  {
    id: 'scientific',
    name: 'Scientific Research',
    description: 'For academic papers, research notes, scientific data, and scholarly content.',
    icon: 'FlaskConical',
    color: 'emerald',
    keywords: ['hypothesis', 'experiment', 'results', 'methodology', 'abstract', 'conclusion', 'peer-reviewed', 'citation', 'journal', 'DOI', 'arxiv', 'thesis', 'dissertation', 'coefficient', 'p-value', 'significance', 'correlation', 'regression', 'dataset', 'sample', 'control', 'variable', 'quantum', 'molecular', 'genome', 'neural', 'entropy'],
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
        description: 'Highest quality for scientific content. Understands technical vocabulary.',
        strengths: ['Highest accuracy', 'Wide domain knowledge', 'Technical terms'],
      },
    ],
  },
  {
    id: 'financial',
    name: 'Finance & Business',
    description: 'For financial reports, market analysis, business strategy, and economic content.',
    icon: 'TrendingUp',
    color: 'sky',
    keywords: ['revenue', 'profit', 'margin', 'EBITDA', 'valuation', 'portfolio', 'equity', 'bond', 'derivative', 'hedge', 'ROI', 'P/E', 'market cap', 'IPO', 'SEC', 'quarterly', 'fiscal', 'cash flow', 'balance sheet', 'income statement', 'dividend', 'yield', 'volatility', 'inflation', 'GDP', 'Fed', 'stock', 'trading'],
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
        description: 'Local option for financial content. Privacy-first for sensitive data.',
        strengths: ['Local', 'Privacy-first', 'No data leaves device'],
      },
    ],
  },
];

// ─── Domain Detection ───────────────────────────────────────────

function detectDomain(text: string): { domain: string; score: number; matches: string[] }[] {
  const lower = text.toLowerCase();
  const words = lower.split(/\s+/);
  const wordSet = new Set(words);
  
  const results = DOMAIN_PROFILES
    .filter(d => d.id !== 'general')
    .map(profile => {
      const matches = profile.keywords.filter(kw => {
        const kwLower = kw.toLowerCase();
        // Check both exact word match and substring for multi-word keywords
        return wordSet.has(kwLower) || lower.includes(kwLower);
      });
      
      // Score based on keyword density
      const score = matches.length / Math.max(profile.keywords.length, 1);
      return { domain: profile.id, score, matches };
    })
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score);
  
  return results;
}

// ─── Route Handler ──────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'config';
    const userId = await getUserId();
    
    switch (action) {
      case 'config': {
        // Get current configuration
        const pluginConfig = await db.execute(sql`
          SELECT config FROM plugins 
          WHERE slug = 'domain-embeddings' AND user_id = ${userId}
        `);
        
        const config = (pluginConfig as any[])[0]?.config || {};
        
        // Check available embedding providers
        const settings = await db.execute(sql`
          SELECT key, value FROM settings 
          WHERE key IN ('openai_api_key', 'gemini_api_key', 'ollama_url', 'embedding_provider')
        `);
        const providerConfig: Record<string, string> = {};
        for (const row of settings as any[]) {
          providerConfig[row.key] = row.value;
        }
        
        const availableProviders = {
          openai: !!(providerConfig.openai_api_key || process.env.OPENAI_API_KEY),
          gemini: !!(providerConfig.gemini_api_key || process.env.GEMINI_API_KEY),
          ollama: !!(providerConfig.ollama_url || process.env.OLLAMA_URL),
        };
        
        return NextResponse.json({
          domains: DOMAIN_PROFILES,
          config,
          availableProviders,
          currentProvider: providerConfig.embedding_provider || 'auto',
        });
      }
      
      case 'stats': {
        // Domain distribution of memories
        const allMemories = await db.execute(sql`
          SELECT id, content, metadata FROM memories 
          WHERE user_id = ${userId}
          ORDER BY created_at DESC
          LIMIT 500
        `);
        
        const domainCounts: Record<string, number> = { general: 0 };
        const domainExamples: Record<string, string[]> = {};
        
        for (const mem of allMemories as any[]) {
          const content = mem.content || '';
          // Check if domain is already tagged
          const existingDomain = mem.metadata?.domain;
          
          if (existingDomain) {
            domainCounts[existingDomain] = (domainCounts[existingDomain] || 0) + 1;
          } else {
            const detected = detectDomain(content);
            if (detected.length > 0 && detected[0].score > 0.05) {
              const domain = detected[0].domain;
              domainCounts[domain] = (domainCounts[domain] || 0) + 1;
              if (!domainExamples[domain]) domainExamples[domain] = [];
              if (domainExamples[domain].length < 3) {
                domainExamples[domain].push(content.slice(0, 100));
              }
            } else {
              domainCounts.general++;
            }
          }
        }
        
        // Get embedding stats
        const embeddingStats = await db.execute(sql`
          SELECT 
            COUNT(*) FILTER (WHERE embedding IS NOT NULL) as with_embeddings,
            COUNT(*) as total
          FROM memories 
          WHERE user_id = ${userId}
        `);
        
        const eStats = (embeddingStats as any[])[0] || {};
        
        return NextResponse.json({
          domainDistribution: Object.entries(domainCounts)
            .map(([domain, count]) => ({
              domain,
              name: DOMAIN_PROFILES.find(d => d.id === domain)?.name || domain,
              count,
              examples: domainExamples[domain] || [],
            }))
            .sort((a, b) => b.count - a.count),
          totalAnalyzed: (allMemories as any[]).length,
          embeddingCoverage: {
            withEmbeddings: parseInt(eStats.with_embeddings || '0'),
            total: parseInt(eStats.total || '0'),
          },
        });
      }
      
      case 'detect': {
        // Detect domain for a given text
        const text = searchParams.get('text');
        if (!text) return NextResponse.json({ error: 'Missing text parameter' }, { status: 400 });
        
        const results = detectDomain(text);
        return NextResponse.json({
          detectedDomains: results,
          primaryDomain: results.length > 0 && results[0].score > 0.05 ? results[0] : { domain: 'general', score: 1, matches: [] },
        });
      }
      
      case 'models': {
        // List available models for a domain
        const domainId = searchParams.get('domain') || 'general';
        const domain = DOMAIN_PROFILES.find(d => d.id === domainId);
        
        if (!domain) return NextResponse.json({ error: 'Unknown domain' }, { status: 404 });
        
        // Check which providers are available
        const settings = await db.execute(sql`
          SELECT key, value FROM settings 
          WHERE key IN ('openai_api_key', 'ollama_url')
        `);
        const provConfig: Record<string, string> = {};
        for (const row of settings as any[]) {
          provConfig[row.key] = row.value;
        }
        
        const models = domain.recommendedModels.map(m => ({
          ...m,
          available: (m.provider === 'openai' && !!(provConfig.openai_api_key || process.env.OPENAI_API_KEY)) ||
                     (m.provider === 'ollama' && !!(provConfig.ollama_url || process.env.OLLAMA_URL)) ||
                     m.provider === 'huggingface', // HF models can be pulled via Ollama
        }));
        
        return NextResponse.json({ domain: domain.id, models });
      }
      
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error: unknown) {
    console.error('[domain-embeddings GET]', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'save-config';
    const userId = await getUserId();
    
    switch (action) {
      case 'save-config': {
        const body = await req.json();
        const { domainModels, autoDetect = true, defaultDomain = 'general' } = body;
        
        // Save domain model configuration
        await db.execute(sql`
          UPDATE plugins SET config = config || ${JSON.stringify({
            domainModels: domainModels || {},
            autoDetect,
            defaultDomain,
          })}::jsonb
          WHERE slug = 'domain-embeddings' AND user_id = ${userId}
        `);
        
        return NextResponse.json({ saved: true });
      }
      
      case 'tag-domain': {
        // Tag a memory with its domain
        const body = await req.json();
        const { memoryId, domain } = body;
        
        if (!memoryId) return NextResponse.json({ error: 'Missing memoryId' }, { status: 400 });
        
        const validDomain = DOMAIN_PROFILES.find(d => d.id === domain);
        if (!validDomain && domain !== 'general') {
          return NextResponse.json({ error: 'Invalid domain' }, { status: 400 });
        }
        
        // Update metadata with domain
        await db.execute(sql`
          UPDATE memories 
          SET metadata = COALESCE(metadata, '{}'::jsonb) || ${JSON.stringify({ domain })}::jsonb
          WHERE id = ${memoryId} AND user_id = ${userId}
        `);
        
        return NextResponse.json({ tagged: true, memoryId, domain });
      }
      
      case 'batch-detect': {
        // Auto-detect and tag domains for untagged memories
        const body = await req.json().catch(() => ({}));
        const batchSize = body.batchSize || 100;
        
        const untagged = await db.execute(sql`
          SELECT id, content, metadata FROM memories 
          WHERE user_id = ${userId}
          AND (metadata->>'domain' IS NULL OR metadata->>'domain' = '')
          ORDER BY created_at DESC
          LIMIT ${batchSize}
        `);
        
        let tagged = 0;
        const domainCounts: Record<string, number> = {};
        
        for (const mem of untagged as any[]) {
          const content = mem.content || '';
          const detected = detectDomain(content);
          const domain = detected.length > 0 && detected[0].score > 0.05 ? detected[0].domain : 'general';
          
          const existingMeta = mem.metadata || {};
          const newMeta = { ...existingMeta, domain };
          
          await db.execute(sql`
            UPDATE memories SET metadata = ${JSON.stringify(newMeta)}::jsonb
            WHERE id = ${mem.id} AND user_id = ${userId}
          `);
          
          tagged++;
          domainCounts[domain] = (domainCounts[domain] || 0) + 1;
        }
        
        const remaining = await db.execute(sql`
          SELECT COUNT(*) as count FROM memories 
          WHERE user_id = ${userId}
          AND (metadata->>'domain' IS NULL OR metadata->>'domain' = '')
        `);
        
        return NextResponse.json({
          tagged,
          remaining: parseInt((remaining as any[])[0]?.count || '0'),
          domainCounts,
        });
      }
      
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error: unknown) {
    console.error('[domain-embeddings POST]', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal error' }, { status: 500 });
  }
}
