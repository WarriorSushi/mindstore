"use client";

import { GraduationCap } from "lucide-react";
import { RouteError } from "@/components/RouteError";

export default function FlashcardsError({
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
      title="Couldn't load flashcards"
      icon={GraduationCap}
    />
  );
}
