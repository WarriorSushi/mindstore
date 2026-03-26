"use client";

import { BarChart3 } from "lucide-react";
import { RouteError } from "@/components/RouteError";

export default function StatsError({
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
      title="Couldn't load statistics"
      icon={BarChart3}
    />
  );
}
