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

const DEMO_MEMORIES = [
  { content: "Discussed the difference between transformers and RNNs. Transformers use self-attention to process all tokens in parallel, while RNNs process sequentially. The key innovation was the attention mechanism from 'Attention Is All You Need' (2017).", sourceType: 'chatgpt', sourceTitle: 'AI Architecture Deep Dive' },
  { content: "Explored how neural networks learn features hierarchically — edges in early layers, textures in middle layers, and high-level concepts in deeper layers. This is why transfer learning works so well.", sourceType: 'chatgpt', sourceTitle: 'AI Architecture Deep Dive' },
  { content: "Talked about the history of coffee. Originally discovered in Ethiopia, spread through Yemen and the Ottoman Empire. The first European coffeehouse opened in Venice in 1629.", sourceType: 'chatgpt', sourceTitle: 'Random Knowledge Rabbit Holes' },
  { content: "The Dunning-Kruger effect isn't actually what most people think. The original paper showed a regression-to-the-mean effect. Low performers overestimate, high performers underestimate, but the gap is smaller than pop psychology suggests.", sourceType: 'chatgpt', sourceTitle: 'Psychology Misconceptions' },
  { content: "Spaced repetition is the most evidence-backed learning technique. The forgetting curve (Ebbinghaus, 1885) shows exponential decay, but each review extends retention. Optimal intervals: 1 day, 3 days, 7 days, 21 days, 60 days.", sourceType: 'chatgpt', sourceTitle: 'Learning Science' },
  { content: "Stoicism isn't about suppressing emotions — it's about distinguishing what you can control from what you can't. Marcus Aurelius wrote Meditations as personal notes, never meant for publication. Epictetus was a former slave.", sourceType: 'chatgpt', sourceTitle: 'Philosophy Conversations' },
  { content: "The microbiome contains more bacterial cells than human cells. Gut bacteria produce neurotransmitters like serotonin and GABA. The gut-brain axis is bidirectional — stress affects gut health and vice versa.", sourceType: 'chatgpt', sourceTitle: 'Health & Biology' },
  { content: "Discussed startup fundraising. Pre-seed: $50K-$500K for idea validation. Seed: $500K-$2M for MVP. Series A: $2M-$15M for product-market fit. The key metric investors look for changes at each stage.", sourceType: 'chatgpt', sourceTitle: 'Startup Strategy' },
  { content: "React Server Components vs Client Components: RSCs run on the server, reduce bundle size, can access databases directly. Client components handle interactivity. The 'use client' directive marks the boundary.", sourceType: 'chatgpt', sourceTitle: 'Web Dev Deep Dives' },
  { content: "The Fermi Paradox: if the universe is so vast, where is everyone? Leading hypotheses: Great Filter (civilizations self-destruct), Zoo Hypothesis (we're being observed), Dark Forest theory (civilizations hide).", sourceType: 'chatgpt', sourceTitle: 'Space & Physics' },
  { content: "Book notes: 'Thinking, Fast and Slow' by Kahneman. System 1 is fast, intuitive, emotional. System 2 is slow, deliberate, logical. Most decisions use System 1. Cognitive biases arise from System 1 shortcuts.", sourceType: 'text', sourceTitle: 'Book Notes Collection' },
  { content: "Idea: Build a tool that maps your knowledge graph from all your AI conversations. Show clusters, connections, blind spots. Make the invisible visible.", sourceType: 'text', sourceTitle: 'Product Ideas' },
  { content: "Daily reflection: Realized I learn best by explaining things to others. The Feynman technique works because it exposes gaps in understanding. Teaching is the highest form of learning.", sourceType: 'text', sourceTitle: 'Journal Entries' },
  { content: "Meeting notes: Discussed pivot from B2C to B2B. Enterprise customers have higher LTV but longer sales cycles. Need to balance with self-serve growth motion.", sourceType: 'text', sourceTitle: 'Work Notes' },
  { content: "Research paper summary: 'Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks' (2020). RAG combines retrieval and generation — retrieve relevant documents, then generate answers conditioned on them. Outperforms pure parametric models on knowledge tasks.", sourceType: 'file', sourceTitle: 'Research Papers PDF' },
  { content: "Course notes from MIT OCW 6.006: Introduction to Algorithms. Big-O notation measures worst-case growth rate. Hash tables O(1) average lookup. Binary search O(log n). Merge sort O(n log n).", sourceType: 'file', sourceTitle: 'CS Course Notes' },
  { content: "Article: 'The Bitter Lesson' by Rich Sutton. The biggest lesson from 70 years of AI research is that general methods leveraging computation are ultimately the most effective. Search and learning scale, hand-crafted features don't.", sourceType: 'url', sourceTitle: 'The Bitter Lesson - Rich Sutton' },
  { content: "Blog post on second-order thinking: First-order = 'what happens next?' Second-order = 'and then what?' Most people only think first-order. Great strategists chain consequences 3-4 levels deep.", sourceType: 'url', sourceTitle: 'Farnam Street Blog' },
  { content: "The Mediterranean diet isn't just about food — it's about eating patterns. Slow meals, social eating, seasonal ingredients. Blue Zones research shows it's the lifestyle, not just the nutrients.", sourceType: 'chatgpt', sourceTitle: 'Health & Biology' },
  { content: "Compound interest applies to knowledge too. Learning math helps you learn physics. Learning physics helps you understand engineering. Each domain amplifies the others. Charlie Munger calls these 'mental models'.", sourceType: 'chatgpt', sourceTitle: 'Learning Science' },
  { content: "TypeScript's type system is Turing complete. You can implement arithmetic, string manipulation, even simple programs entirely in the type system. Useful for ensuring API contracts at compile time.", sourceType: 'chatgpt', sourceTitle: 'Web Dev Deep Dives' },
  { content: "The Lindy Effect: the longer something has survived, the longer it's likely to survive. Books that have been read for 100 years will likely be read for another 100. New tech has higher mortality.", sourceType: 'chatgpt', sourceTitle: 'Random Knowledge Rabbit Holes' },
  { content: "Contradiction noted: I believe in long-term planning but also that 'plans are useless, planning is everything' (Eisenhower). The process of planning builds understanding even if the plan changes.", sourceType: 'text', sourceTitle: 'Journal Entries' },
  { content: "The default mode network activates when we're not focused on external tasks. It's responsible for mind-wandering, self-reflection, and creativity. Constant stimulation (phone scrolling) suppresses it.", sourceType: 'chatgpt', sourceTitle: 'Psychology Misconceptions' },
];

export async function loadDemoData() {
  // Import demo data via the server API
  const documents = DEMO_MEMORIES.map(m => ({
    title: m.sourceTitle,
    content: m.content,
    sourceType: m.sourceType,
  }));

  try {
    const res = await fetch('/api/v1/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documents }),
    });
    if (!res.ok) throw new Error('Demo import failed');
  } catch (e) {
    console.error('Demo load failed:', e);
  }

  setDemoMode(true);
}

export async function clearDemoData() {
  try {
    await fetch('/api/v1/memories', { method: 'DELETE' });
  } catch (e) {
    console.error('Demo clear failed:', e);
  }
  setDemoMode(false);
}
