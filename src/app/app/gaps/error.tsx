"use client";

import { Target } from "lucide-react";
import { RouteError } from "@/components/RouteError";

export default function GapsError({
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
      title="Couldn't load gap analysis"
      icon={Target}
    />
  );
}
