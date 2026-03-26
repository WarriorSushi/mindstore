"use client";

import { Puzzle } from "lucide-react";
import { RouteError } from "@/components/RouteError";

export default function PluginsError({
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
      title="Couldn't load plugins"
      icon={Puzzle}
    />
  );
}
