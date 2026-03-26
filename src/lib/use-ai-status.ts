"use client";

import { useState, useEffect } from "react";

interface AiStatus {
  /** true once the fetch completes */
  loaded: boolean;
  /** true if at least one AI provider is configured */
  hasAi: boolean;
  /** which provider label is active, if any */
  activeProvider: string | null;
}

const CACHE_KEY = "mindstore_ai_status";
const CACHE_TTL = 30_000; // 30 seconds

interface CachedStatus {
  hasAi: boolean;
  activeProvider: string | null;
  ts: number;
}

/**
 * Hook to check whether AI is configured.
 * Caches in sessionStorage to avoid hammering /api/v1/settings on every page.
 */
export function useAiStatus(): AiStatus {
  const [status, setStatus] = useState<AiStatus>({
    loaded: false,
    hasAi: true, // optimistic default prevents flash
    activeProvider: null,
  });

  useEffect(() => {
    // Check cache first
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (raw) {
        const cached: CachedStatus = JSON.parse(raw);
        if (Date.now() - cached.ts < CACHE_TTL) {
          setStatus({
            loaded: true,
            hasAi: cached.hasAi,
            activeProvider: cached.activeProvider,
          });
          return;
        }
      }
    } catch {}

    let cancelled = false;
    fetch("/api/v1/settings")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const hasAi = !!data.hasApiKey;
        const activeProvider =
          data.chatProvider || data.chat_provider || null;

        // Cache it
        try {
          sessionStorage.setItem(
            CACHE_KEY,
            JSON.stringify({ hasAi, activeProvider, ts: Date.now() })
          );
        } catch {}

        setStatus({ loaded: true, hasAi, activeProvider });
      })
      .catch(() => {
        if (!cancelled) {
          setStatus({ loaded: true, hasAi: false, activeProvider: null });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return status;
}

/**
 * Invalidate the cached AI status (call after user saves settings).
 */
export function invalidateAiStatus() {
  try {
    sessionStorage.removeItem(CACHE_KEY);
  } catch {}
}
