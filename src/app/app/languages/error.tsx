"use client";

import { Languages } from "lucide-react";
import { RouteError } from "@/components/RouteError";

export default function LanguagesError({
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
      title="Couldn't load language analysis"
      icon={Languages}
    />
  );
}
