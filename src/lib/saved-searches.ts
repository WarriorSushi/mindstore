/**
 * Saved Searches — localStorage-backed smart filters
 * Users can save frequently used search + filter combinations
 * and recall them instantly from the Explore page or Command Palette.
 */

export interface SavedSearch {
  id: string;
  name: string;
  query: string;
  sourceFilter: string | null;
  tagFilter: string | null;
  sortBy: string;
  pinned: boolean;
  color: 'teal' | 'sky' | 'emerald' | 'amber' | 'red' | 'blue';
  createdAt: string;
  lastUsedAt: string;
  useCount: number;
}

const STORAGE_KEY = 'mindstore-saved-searches';

function load(): SavedSearch[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save(searches: SavedSearch[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(searches));
}

export function getSavedSearches(): SavedSearch[] {
  return load().sort((a, b) => {
    // Pinned first, then by last used
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime();
  });
}

export function createSavedSearch(params: {
  name: string;
  query: string;
  sourceFilter: string | null;
  tagFilter: string | null;
  sortBy: string;
  color?: SavedSearch['color'];
}): SavedSearch {
  const searches = load();
  const newSearch: SavedSearch = {
    id: `ss-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: params.name,
    query: params.query,
    sourceFilter: params.sourceFilter,
    tagFilter: params.tagFilter,
    sortBy: params.sortBy,
    pinned: false,
    color: params.color || 'teal',
    createdAt: new Date().toISOString(),
    lastUsedAt: new Date().toISOString(),
    useCount: 0,
  };
  searches.push(newSearch);
  save(searches);
  return newSearch;
}

export function useSavedSearch(id: string): SavedSearch | null {
  const searches = load();
  const idx = searches.findIndex(s => s.id === id);
  if (idx === -1) return null;
  searches[idx].lastUsedAt = new Date().toISOString();
  searches[idx].useCount++;
  save(searches);
  return searches[idx];
}

export function updateSavedSearch(id: string, updates: Partial<Pick<SavedSearch, 'name' | 'color' | 'pinned'>>): SavedSearch | null {
  const searches = load();
  const idx = searches.findIndex(s => s.id === id);
  if (idx === -1) return null;
  Object.assign(searches[idx], updates);
  save(searches);
  return searches[idx];
}

export function deleteSavedSearch(id: string): boolean {
  const searches = load();
  const filtered = searches.filter(s => s.id !== id);
  if (filtered.length === searches.length) return false;
  save(filtered);
  return true;
}

export function togglePinSavedSearch(id: string): boolean {
  const searches = load();
  const idx = searches.findIndex(s => s.id === id);
  if (idx === -1) return false;
  searches[idx].pinned = !searches[idx].pinned;
  save(searches);
  return searches[idx].pinned;
}

/** Check if current search state matches any saved search */
export function findMatchingSavedSearch(params: {
  query: string;
  sourceFilter: string | null;
  tagFilter: string | null;
  sortBy: string;
}): SavedSearch | null {
  const searches = load();
  return searches.find(s =>
    s.query === params.query &&
    s.sourceFilter === params.sourceFilter &&
    s.tagFilter === params.tagFilter &&
    s.sortBy === params.sortBy
  ) || null;
}

/** Get the description of a saved search for display */
export function describeSavedSearch(s: SavedSearch): string {
  const parts: string[] = [];
  if (s.query) parts.push(`"${s.query}"`);
  if (s.sourceFilter) parts.push(`source: ${s.sourceFilter}`);
  if (s.tagFilter) parts.push(`tag: ${s.tagFilter}`);
  if (s.sortBy && s.sortBy !== 'newest') parts.push(`sort: ${s.sortBy}`);
  return parts.length > 0 ? parts.join(' · ') : 'All memories';
}
