"use client";

import { GraduationCap } from "lucide-react";
import { RouteError } from "@/components/RouteError";

export default function LearnError({
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
      title="Couldn't load learning modules"
      icon={GraduationCap}
    />
  );
}
