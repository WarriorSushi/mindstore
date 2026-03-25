/**
 * Search History — localStorage-backed recent search tracking
 */

const STORAGE_KEY = 'mindstore-search-history';
const MAX_HISTORY = 20;

export interface SearchHistoryItem {
  query: string;
  timestamp: string;
  resultCount?: number;
}

function load(): SearchHistoryItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save(items: SearchHistoryItem[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function addSearchToHistory(query: string, resultCount?: number): void {
  if (!query.trim()) return;
  const items = load();
  // Remove duplicates of this exact query
  const filtered = items.filter(i => i.query.toLowerCase() !== query.toLowerCase());
  filtered.unshift({
    query: query.trim(),
    timestamp: new Date().toISOString(),
    resultCount,
  });
  save(filtered.slice(0, MAX_HISTORY));
}

export function getSearchHistory(): SearchHistoryItem[] {
  return load();
}

export function clearSearchHistory(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

export function removeSearchFromHistory(query: string): void {
  const items = load();
  save(items.filter(i => i.query.toLowerCase() !== query.toLowerCase()));
}
