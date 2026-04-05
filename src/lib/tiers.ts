/**
 * MindStore tier definitions and usage limits.
 *
 * Free tier is generous — the goal is to convert power users, not gatekeep.
 * Pro tier unlocks unlimited usage + advanced features.
 */

export const TIERS = {
  free: {
    name: 'Free',
    maxMemories: 2000,
    maxSources: 20,
    maxAiQueriesPerDay: 50,
    maxFlashcardDecks: 5,
    maxConnectionsStored: 500,
    features: ['import', 'search', 'chat', 'flashcards', 'fingerprint', 'mcp'],
  },
  pro: {
    name: 'Pro',
    maxMemories: Infinity,
    maxSources: Infinity,
    maxAiQueriesPerDay: Infinity,
    maxFlashcardDecks: Infinity,
    maxConnectionsStored: Infinity,
    features: ['import', 'search', 'chat', 'flashcards', 'fingerprint', 'mcp', 'mind-export', 'team', 'priority-support'],
  },
} as const;

export type Tier = keyof typeof TIERS;

/** Threshold at which we show the upgrade CTA (% of limit used) */
export const UPGRADE_NUDGE_THRESHOLD = 0.80;

/** Current price — update when Dodo Payments is live */
export const PRO_PRICE_USD = 9;

export function isAtLimit(used: number, tier: Tier, resource: keyof typeof TIERS.free): boolean {
  const limit = TIERS[tier][resource];
  return typeof limit === 'number' && isFinite(limit) && used >= limit;
}

export function isNearLimit(used: number, tier: Tier, resource: keyof typeof TIERS.free): boolean {
  const limit = TIERS[tier][resource];
  return typeof limit === 'number' && isFinite(limit) && used / limit >= UPGRADE_NUDGE_THRESHOLD;
}

export function percentUsed(used: number, tier: Tier, resource: keyof typeof TIERS.free): number {
  const limit = TIERS[tier][resource];
  if (typeof limit !== 'number' || !isFinite(limit)) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}
