"use client";

import { Copy } from "lucide-react";
import { RouteError } from "@/components/RouteError";

export default function DuplicatesError({
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
      title="Couldn't load the duplicates finder"
      icon={Copy}
    />
  );
}
