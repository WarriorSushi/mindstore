/**
 * Plausible analytics helpers — thin wrapper around window.plausible.
 * No-ops when Plausible is not loaded (dev, or domain not set).
 */

declare global {
  interface Window {
    plausible?: (event: string, opts?: { props?: Record<string, string | number> }) => void;
  }
}

export function trackEvent(event: string, props?: Record<string, string | number>) {
  if (typeof window !== 'undefined' && typeof window.plausible === 'function') {
    window.plausible(event, props ? { props } : undefined);
  }
}

// Named event constants to keep tracking consistent across the codebase
export const track = {
  import: (source: string, count: number) => trackEvent('Import', { source, count }),
  aiQuery: (provider: string) => trackEvent('AI Query', { provider }),
  devilAdvocate: () => trackEvent('Devil Advocate Query'),
  signup: () => trackEvent('Signup'),
  onboardingComplete: () => trackEvent('Onboarding Complete'),
  connectionDiscover: () => trackEvent('Connection Discover'),
  mindFileExport: () => trackEvent('.mind Export'),
};
