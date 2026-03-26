"use client";

import { FolderOpen } from "lucide-react";
import { RouteError } from "@/components/RouteError";

export default function CollectionsError({
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
      title="Couldn't load your collections"
      icon={FolderOpen}
    />
  );
}
