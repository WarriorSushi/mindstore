"use client";

import { Lightbulb } from "lucide-react";
import { RouteError } from "@/components/RouteError";

export default function InsightsError({
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
      title="Couldn't load your insights"
      icon={Lightbulb}
    />
  );
}
