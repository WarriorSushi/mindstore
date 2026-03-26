"use client";

import { Search } from "lucide-react";
import { RouteError } from "@/components/RouteError";

export default function RetrievalError({
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
      title="Couldn't load retrieval test"
      icon={Search}
    />
  );
}
