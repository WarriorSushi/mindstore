"use client";

import { TrendingUp } from "lucide-react";
import { RouteError } from "@/components/RouteError";

export default function EvolutionError({
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
      title="Couldn't load evolution tracking"
      icon={TrendingUp}
    />
  );
}
