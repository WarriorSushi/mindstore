/**
 * Reddit Saved Posts Importer — Portable logic module
 *
 * Extracted from the route for convergence with codex runtime.
 * Handles: CSV/JSON parsing, content formatting, stats building, chunking.
 */

// ─── Types ────────────────────────────────────────────────────

export interface RedditPost {
  id: string;
  title: string;
  body: string;
  subreddit: string;
  author: string;
  url: string;
  permalink: string;
  score: number;
  created: string;
  type: 'post' | 'comment';
  parentTitle?: string;
  isLink: boolean;
}

export interface RedditParseStats {
  totalPosts: number;
  totalComments: number;
  totalItems: number;
  subreddits: { name: string; count: number }[];
  dateRange: { oldest: string | null; newest: string | null };
  topAuthors: { name: string; count: number }[];
  avgScore: number;
}

export interface RedditSampleItem {
  title: string;
  subreddit: string;
  type: 'post' | 'comment';
  score: number;
  preview: string;
  date: string;
}

// ─── CSV Parser ─────────────────────────────────────────────

export function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const clean = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let current: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    const next = clean[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        current.push(field);
        field = '';
      } else if (ch === '\n' || (ch === '\r' && next === '\n')) {
        current.push(field);
        field = '';
        if (current.some(f => f.trim())) rows.push(current);
        current = [];
        if (ch === '\r') i++;
      } else {
        field += ch;
      }
    }
  }
  current.push(field);
  if (current.some(f => f.trim())) rows.push(current);

  if (rows.length === 0) return { headers: [], rows: [] };

  const headers = rows[0].map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const dataRows = rows.slice(1).map(row => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = (row[i] || '').trim(); });
    return obj;
  });

  return { headers, rows: dataRows };
}

// ─── Date Parser ─────────────────────────────────────────────

export function parseRedditDate(dateStr: string): string | null {
  if (!dateStr) return null;
  const num = Number(dateStr);
  if (!isNaN(num) && num > 1e9 && num < 1e11) {
    return new Date(num * 1000).toISOString();
  }
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d.toISOString();
  return null;
}

// ─── Extract Posts from CSV ──────────────────────────────────

export function extractPostsFromCSV(csvText: string, type: 'post' | 'comment'): RedditPost[] {
  const { rows } = parseCSV(csvText);
  if (rows.length === 0) return [];

  const fieldMap: Record<string, string[]> = {
    id: ['id', 'post_id', 'comment_id', 'thing_id'],
    title: ['title', 'post_title', 'link_title', 'submission_title'],
    body: ['body', 'selftext', 'self_text', 'text', 'content', 'comment_body'],
    subreddit: ['subreddit', 'subreddit_name', 'community', 'sr'],
    author: ['author', 'author_name', 'username', 'user'],
    url: ['url', 'link_url', 'post_url'],
    permalink: ['permalink', 'link', 'post_link'],
    score: ['score', 'upvotes', 'ups', 'points'],
    created: ['date', 'created', 'created_utc', 'created_at', 'timestamp', 'time', 'post_date'],
  };

  function findField(row: Record<string, string>, candidates: string[]): string {
    for (const c of candidates) {
      if (row[c] !== undefined && row[c] !== '') return row[c];
    }
    return '';
  }

  return rows
    .map(row => {
      const id = findField(row, fieldMap.id) || Math.random().toString(36).slice(2);
      const title = findField(row, fieldMap.title);
      const body = findField(row, fieldMap.body);
      const subreddit = findField(row, fieldMap.subreddit).replace(/^r\//, '');
      const author = findField(row, fieldMap.author).replace(/^u\//, '');
      const url = findField(row, fieldMap.url);
      const permalink = findField(row, fieldMap.permalink);
      const scoreStr = findField(row, fieldMap.score);
      const createdStr = findField(row, fieldMap.created);

      if (!title && !body && !permalink) return null;

      return {
        id,
        title: title || (type === 'comment' ? 'Comment' : 'Post'),
        body: body || '',
        subreddit,
        author,
        url: url || '',
        permalink: permalink || '',
        score: parseInt(scoreStr) || 0,
        created: parseRedditDate(createdStr) || new Date().toISOString(),
        type,
        parentTitle: type === 'comment' ? title : undefined,
        isLink: !!(url && url !== permalink && !url.includes('reddit.com')),
      } as RedditPost;
    })
    .filter(Boolean) as RedditPost[];
}

// ─── Reference CSV Parser ────────────────────────────────────

export function parseReferenceCSV(csvText: string, type: 'post' | 'comment'): RedditPost[] {
  const { rows } = parseCSV(csvText);
  if (rows.length === 0) return [];

  return rows
    .map(row => {
      const id = row.id || row.thing_id || Math.random().toString(36).slice(2);
      const permalink = row.permalink || row.link || '';
      const dateStr = row.date || row.created || row.created_utc || '';

      if (!permalink) return null;

      const subMatch = permalink.match(/\/r\/([^/]+)/);
      const subreddit = subMatch ? subMatch[1] : '';

      const titleMatch = permalink.match(/\/comments\/[^/]+\/([^/]+)/);
      const title = titleMatch
        ? titleMatch[1].replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())
        : (type === 'comment' ? 'Saved Comment' : 'Saved Post');

      return {
        id,
        title,
        body: '',
        subreddit,
        author: '',
        url: `https://www.reddit.com${permalink}`,
        permalink,
        score: 0,
        created: parseRedditDate(dateStr) || new Date().toISOString(),
        type,
        isLink: false,
      } as RedditPost;
    })
    .filter(Boolean) as RedditPost[];
}

// ─── JSON Export Parser ──────────────────────────────────────

export function parseRedditJSON(jsonText: string): RedditPost[] {
  try {
    const data = JSON.parse(jsonText);
    const items = Array.isArray(data)
      ? data
      : (data.data || data.children || data.posts || data.saved || []);

    return items
      .map((item: any) => {
        const d = item.data || item;
        const type: 'post' | 'comment' = (
          d.body !== undefined || item.kind === 't1' || d.type === 'comment'
        ) ? 'comment' : 'post';

        return {
          id: d.id || d.name || Math.random().toString(36).slice(2),
          title: d.title || d.link_title || (type === 'comment' ? 'Comment' : 'Post'),
          body: d.body || d.selftext || d.self_text || d.text || '',
          subreddit: (d.subreddit || d.subreddit_name_prefixed || '').replace(/^r\//, ''),
          author: (d.author || d.author_name || '').replace(/^u\//, ''),
          url: d.url || d.link_url || '',
          permalink: d.permalink || '',
          score: d.score || d.ups || 0,
          created: parseRedditDate(String(d.created_utc || d.created || d.date || '')) || new Date().toISOString(),
          type,
          parentTitle: type === 'comment' ? (d.link_title || d.title) : undefined,
          isLink: !!(d.url && !d.is_self && !d.url.includes('reddit.com')),
        } as RedditPost;
      })
      .filter((p: RedditPost) => p.title || p.body);
  } catch {
    return [];
  }
}

// ─── Content Formatter ──────────────────────────────────────

export function formatRedditContent(item: RedditPost): { title: string; content: string } {
  const parts: string[] = [];

  if (item.type === 'comment') {
    parts.push(`**Comment** on r/${item.subreddit}`);
    if (item.parentTitle) parts.push(`Re: ${item.parentTitle}`);
  } else {
    parts.push(`**${item.title}**`);
    parts.push(`r/${item.subreddit}`);
  }

  const meta: string[] = [];
  if (item.author) meta.push(`u/${item.author}`);
  if (item.score) meta.push(`${item.score} points`);
  if (item.created) {
    const d = new Date(item.created);
    meta.push(d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }));
  }
  if (meta.length > 0) parts.push(meta.join(' · '));

  if (item.body) {
    parts.push('', item.body);
  }

  if (item.isLink && item.url) {
    parts.push('', `🔗 ${item.url}`);
  }

  if (item.permalink) {
    const fullUrl = item.permalink.startsWith('http')
      ? item.permalink
      : `https://www.reddit.com${item.permalink}`;
    parts.push('', `Source: ${fullUrl}`);
  }

  const title = item.type === 'comment'
    ? `💬 Comment on r/${item.subreddit}: ${item.parentTitle || item.title}`.slice(0, 200)
    : `📝 r/${item.subreddit}: ${item.title}`.slice(0, 200);

  return { title, content: parts.join('\n') };
}

// ─── Chunking ────────────────────────────────────────────────

export function chunkContent(content: string, maxChars: number = 4000): string[] {
  if (content.length <= maxChars) return [content];

  const chunks: string[] = [];
  const paragraphs = content.split('\n\n');
  let current = '';

  for (const para of paragraphs) {
    if (current.length + para.length + 2 > maxChars && current) {
      chunks.push(current.trim());
      current = '';
    }
    current += (current ? '\n\n' : '') + para;
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

// ─── Stats Builder ───────────────────────────────────────────

export function buildStats(posts: RedditPost[], comments: RedditPost[]): RedditParseStats {
  const all = [...posts, ...comments];

  const subCounts = new Map<string, number>();
  for (const item of all) {
    if (item.subreddit) {
      subCounts.set(item.subreddit, (subCounts.get(item.subreddit) || 0) + 1);
    }
  }
  const subreddits = Array.from(subCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const authorCounts = new Map<string, number>();
  for (const item of all) {
    if (item.author) {
      authorCounts.set(item.author, (authorCounts.get(item.author) || 0) + 1);
    }
  }
  const topAuthors = Array.from(authorCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const dates = all.map(i => new Date(i.created).getTime()).filter(t => !isNaN(t)).sort();
  const oldest = dates.length > 0
    ? new Date(dates[0]).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
    : null;
  const newest = dates.length > 0
    ? new Date(dates[dates.length - 1]).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
    : null;

  const totalScore = all.reduce((s, i) => s + (i.score || 0), 0);

  return {
    totalPosts: posts.length,
    totalComments: comments.length,
    totalItems: all.length,
    subreddits,
    dateRange: { oldest, newest },
    topAuthors,
    avgScore: all.length > 0 ? Math.round(totalScore / all.length) : 0,
  };
}

export function buildSampleItems(posts: RedditPost[], comments: RedditPost[]): RedditSampleItem[] {
  return [...posts, ...comments]
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 8)
    .map(item => ({
      title: item.type === 'comment'
        ? (item.parentTitle || item.title || 'Comment').slice(0, 100)
        : (item.title || 'Post').slice(0, 100),
      subreddit: item.subreddit,
      type: item.type,
      score: item.score,
      preview: (item.body || '').slice(0, 150),
      date: item.created
        ? new Date(item.created).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
        : '',
    }));
}
