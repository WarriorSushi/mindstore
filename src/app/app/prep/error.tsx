"use client";

import { MessageSquare } from "lucide-react";
import { RouteError } from "@/components/RouteError";

export default function PrepError({
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
      title="Couldn't load interview prep"
      icon={MessageSquare}
    />
  );
}
