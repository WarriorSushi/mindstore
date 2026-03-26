"use client";

import { Upload } from "lucide-react";
import { RouteError } from "@/components/RouteError";

export default function ImportError({
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
      title="Couldn't load the importer"
      icon={Upload}
    />
  );
}
