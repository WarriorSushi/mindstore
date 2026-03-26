"use client";

import { RefreshCw } from "lucide-react";
import { RouteError } from "@/components/RouteError";

export default function NotionSyncError({
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
      title="Couldn't load Notion sync"
      icon={RefreshCw}
    />
  );
}
