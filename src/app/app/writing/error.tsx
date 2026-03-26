"use client";

import { PenTool } from "lucide-react";
import { RouteError } from "@/components/RouteError";

export default function WritingError({
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
      title="Couldn't load writing analysis"
      icon={PenTool}
    />
  );
}
