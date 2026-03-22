import { db, type Memory, type Source } from './db';
import { v4 as uuidv4 } from 'uuid';

const DEMO_KEY = 'mindstore_demo_mode';

export function isDemoMode(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(DEMO_KEY) === 'true';
}

export function setDemoMode(on: boolean) {
  if (on) {
    localStorage.setItem(DEMO_KEY, 'true');
  } else {
    localStorage.removeItem(DEMO_KEY);
  }
}

// Generate a fake embedding (random unit vector, 1536 dims like text-embedding-3-small)
function fakeEmbedding(seed: number): number[] {
  const emb: number[] = [];
  let x = seed;
  for (let i = 0; i < 1536; i++) {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    emb.push((x / 0x7fffffff) * 2 - 1);
  }
  const norm = Math.sqrt(emb.reduce((s, v) => s + v * v, 0));
  return emb.map(v => v / norm);
}

const DEMO_MEMORIES: { content: string; source: Memory['source']; sourceTitle: string; seed: number }[] = [
  // ChatGPT conversations
  { content: "Discussed the difference between transformers and RNNs. Transformers use self-attention to process all tokens in parallel, while RNNs process sequentially. The key innovation was the attention mechanism from 'Attention Is All You Need' (2017).", source: 'chatgpt', sourceTitle: 'AI Architecture Deep Dive', seed: 1 },
  { content: "Explored how neural networks learn features hierarchically — edges in early layers, textures in middle layers, and high-level concepts in deeper layers. This is why transfer learning works so well.", source: 'chatgpt', sourceTitle: 'AI Architecture Deep Dive', seed: 2 },
  { content: "Talked about the history of coffee. Originally discovered in Ethiopia, spread through Yemen and the Ottoman Empire. The first European coffeehouse opened in Venice in 1629.", source: 'chatgpt', sourceTitle: 'Random Knowledge Rabbit Holes', seed: 3 },
  { content: "The Dunning-Kruger effect isn't actually what most people think. The original paper showed a regression-to-the-mean effect. Low performers overestimate, high performers underestimate, but the gap is smaller than pop psychology suggests.", source: 'chatgpt', sourceTitle: 'Psychology Misconceptions', seed: 4 },
  { content: "Spaced repetition is the most evidence-backed learning technique. The forgetting curve (Ebbinghaus, 1885) shows exponential decay, but each review extends retention. Optimal intervals: 1 day, 3 days, 7 days, 21 days, 60 days.", source: 'chatgpt', sourceTitle: 'Learning Science', seed: 5 },
  { content: "Stoicism isn't about suppressing emotions — it's about distinguishing what you can control from what you can't. Marcus Aurelius wrote Meditations as personal notes, never meant for publication. Epictetus was a former slave.", source: 'chatgpt', sourceTitle: 'Philosophy Conversations', seed: 6 },
  { content: "The microbiome contains more bacterial cells than human cells. Gut bacteria produce neurotransmitters like serotonin and GABA. The gut-brain axis is bidirectional — stress affects gut health and vice versa.", source: 'chatgpt', sourceTitle: 'Health & Biology', seed: 7 },
  { content: "Discussed startup fundraising. Pre-seed: $50K-$500K for idea validation. Seed: $500K-$2M for MVP. Series A: $2M-$15M for product-market fit. The key metric investors look for changes at each stage.", source: 'chatgpt', sourceTitle: 'Startup Strategy', seed: 8 },
  { content: "React Server Components vs Client Components: RSCs run on the server, reduce bundle size, can access databases directly. Client components handle interactivity. The 'use client' directive marks the boundary.", source: 'chatgpt', sourceTitle: 'Web Dev Deep Dives', seed: 9 },
  { content: "The Fermi Paradox: if the universe is so vast, where is everyone? Leading hypotheses: Great Filter (civilizations self-destruct), Zoo Hypothesis (we're being observed), Dark Forest theory (civilizations hide).", source: 'chatgpt', sourceTitle: 'Space & Physics', seed: 10 },

  // Text notes
  { content: "Book notes: 'Thinking, Fast and Slow' by Kahneman. System 1 is fast, intuitive, emotional. System 2 is slow, deliberate, logical. Most decisions use System 1. Cognitive biases arise from System 1 shortcuts.", source: 'text', sourceTitle: 'Book Notes Collection', seed: 11 },
  { content: "Idea: Build a tool that maps your knowledge graph from all your AI conversations. Show clusters, connections, blind spots. Make the invisible visible.", source: 'text', sourceTitle: 'Product Ideas', seed: 12 },
  { content: "Daily reflection: Realized I learn best by explaining things to others. The Feynman technique works because it exposes gaps in understanding. Teaching is the highest form of learning.", source: 'text', sourceTitle: 'Journal Entries', seed: 13 },
  { content: "Meeting notes: Discussed pivot from B2C to B2B. Enterprise customers have higher LTV but longer sales cycles. Need to balance with self-serve growth motion.", source: 'text', sourceTitle: 'Work Notes', seed: 14 },

  // File imports
  { content: "Research paper summary: 'Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks' (2020). RAG combines retrieval and generation — retrieve relevant documents, then generate answers conditioned on them. Outperforms pure parametric models on knowledge tasks.", source: 'file', sourceTitle: 'Research Papers PDF', seed: 15 },
  { content: "Course notes from MIT OCW 6.006: Introduction to Algorithms. Big-O notation measures worst-case growth rate. Hash tables O(1) average lookup. Binary search O(log n). Merge sort O(n log n).", source: 'file', sourceTitle: 'CS Course Notes', seed: 16 },

  // URL imports
  { content: "Article: 'The Bitter Lesson' by Rich Sutton. The biggest lesson from 70 years of AI research is that general methods leveraging computation are ultimately the most effective. Search and learning scale, hand-crafted features don't.", source: 'url', sourceTitle: 'The Bitter Lesson - Rich Sutton', seed: 17 },
  { content: "Blog post on second-order thinking: First-order = 'what happens next?' Second-order = 'and then what?' Most people only think first-order. Great strategists chain consequences 3-4 levels deep.", source: 'url', sourceTitle: 'Farnam Street Blog', seed: 18 },

  // More variety
  { content: "The Mediterranean diet isn't just about food — it's about eating patterns. Slow meals, social eating, seasonal ingredients. Blue Zones research shows it's the lifestyle, not just the nutrients.", source: 'chatgpt', sourceTitle: 'Health & Biology', seed: 19 },
  { content: "Compound interest applies to knowledge too. Learning math helps you learn physics. Learning physics helps you understand engineering. Each domain amplifies the others. Charlie Munger calls these 'mental models'.", source: 'chatgpt', sourceTitle: 'Learning Science', seed: 20 },
  { content: "TypeScript's type system is Turing complete. You can implement arithmetic, string manipulation, even simple programs entirely in the type system. Useful for ensuring API contracts at compile time.", source: 'chatgpt', sourceTitle: 'Web Dev Deep Dives', seed: 21 },
  { content: "The Lindy Effect: the longer something has survived, the longer it's likely to survive. Books that have been read for 100 years will likely be read for another 100. New tech has higher mortality.", source: 'chatgpt', sourceTitle: 'Random Knowledge Rabbit Holes', seed: 22 },
  { content: "Contradiction noted: I believe in long-term planning but also that 'plans are useless, planning is everything' (Eisenhower). The process of planning builds understanding even if the plan changes.", source: 'text', sourceTitle: 'Journal Entries', seed: 23 },
  { content: "The default mode network activates when we're not focused on external tasks. It's responsible for mind-wandering, self-reflection, and creativity. Constant stimulation (phone scrolling) suppresses it.", source: 'chatgpt', sourceTitle: 'Psychology Misconceptions', seed: 24 },
];

const DEMO_SOURCES: { id: string; type: Source['type']; title: string; itemCount: number }[] = [
  { id: 'demo-src-1', type: 'chatgpt', title: 'AI Architecture Deep Dive', itemCount: 2 },
  { id: 'demo-src-2', type: 'chatgpt', title: 'Random Knowledge Rabbit Holes', itemCount: 2 },
  { id: 'demo-src-3', type: 'chatgpt', title: 'Psychology Misconceptions', itemCount: 2 },
  { id: 'demo-src-4', type: 'chatgpt', title: 'Learning Science', itemCount: 2 },
  { id: 'demo-src-5', type: 'chatgpt', title: 'Philosophy Conversations', itemCount: 1 },
  { id: 'demo-src-6', type: 'chatgpt', title: 'Health & Biology', itemCount: 2 },
  { id: 'demo-src-7', type: 'chatgpt', title: 'Startup Strategy', itemCount: 1 },
  { id: 'demo-src-8', type: 'chatgpt', title: 'Web Dev Deep Dives', itemCount: 2 },
  { id: 'demo-src-9', type: 'chatgpt', title: 'Space & Physics', itemCount: 1 },
  { id: 'demo-src-10', type: 'text', title: 'Book Notes Collection', itemCount: 1 },
  { id: 'demo-src-11', type: 'text', title: 'Product Ideas', itemCount: 1 },
  { id: 'demo-src-12', type: 'text', title: 'Journal Entries', itemCount: 2 },
  { id: 'demo-src-13', type: 'text', title: 'Work Notes', itemCount: 1 },
  { id: 'demo-src-14', type: 'file', title: 'Research Papers PDF', itemCount: 1 },
  { id: 'demo-src-15', type: 'file', title: 'CS Course Notes', itemCount: 1 },
  { id: 'demo-src-16', type: 'url', title: 'The Bitter Lesson - Rich Sutton', itemCount: 1 },
  { id: 'demo-src-17', type: 'url', title: 'Farnam Street Blog', itemCount: 1 },
];

export async function loadDemoData() {
  // Clear existing data first
  await db.memories.clear();
  await db.sources.clear();

  const now = new Date();
  const memories: Memory[] = DEMO_MEMORIES.map((m, i) => ({
    id: `demo-mem-${i}`,
    content: m.content,
    embedding: fakeEmbedding(m.seed),
    source: m.source,
    sourceId: DEMO_SOURCES.find(s => s.title === m.sourceTitle)?.id || `demo-src-${i}`,
    sourceTitle: m.sourceTitle,
    timestamp: new Date(now.getTime() - (DEMO_MEMORIES.length - i) * 86400000 * 2), // spread over ~48 days
    importedAt: new Date(now.getTime() - (DEMO_MEMORIES.length - i) * 86400000),
    metadata: {},
  }));

  const sources: Source[] = DEMO_SOURCES.map(s => ({
    ...s,
    importedAt: new Date(now.getTime() - Math.random() * 30 * 86400000),
    metadata: {},
  }));

  await db.memories.bulkPut(memories);
  await db.sources.bulkPut(sources);
  setDemoMode(true);
}

export async function clearDemoData() {
  await db.memories.clear();
  await db.sources.clear();
  setDemoMode(false);
}
