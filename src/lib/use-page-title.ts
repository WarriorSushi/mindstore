"use client";

import { useEffect } from "react";

/**
 * Sets the document title with a MindStore suffix.
 * Usage: usePageTitle("Explore") → "Explore — MindStore"
 */
export function usePageTitle(title: string) {
  useEffect(() => {
    const full = title ? `${title} — MindStore` : "MindStore";
    document.title = full;
    return () => {
      // Reset to default when unmounting (optional, Next.js handles this)
    };
  }, [title]);
}
