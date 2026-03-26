"use client";

import { Download } from "lucide-react";
import { RouteError } from "@/components/RouteError";

export default function ExportError({
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
      title="Couldn't load the export page"
      icon={Download}
    />
  );
}
