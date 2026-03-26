"use client";

import { RefreshCw } from "lucide-react";
import { RouteError } from "@/components/RouteError";

export default function ObsidianSyncError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteError
      error={error}
      reset={reset}
      title="Couldn't load Obsidian sync"
      icon={RefreshCw}
    />
  );
}
