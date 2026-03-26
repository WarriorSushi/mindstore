"use client";

import { Compass } from "lucide-react";
import { RouteError } from "@/components/RouteError";

export default function ExploreError({
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
      title="Couldn't load the explorer"
      icon={Compass}
    />
  );
}
