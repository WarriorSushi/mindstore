"use client";

import { FileText } from "lucide-react";
import { RouteError } from "@/components/RouteError";

export default function BlogError({
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
      title="Couldn't load the blog generator"
      icon={FileText}
    />
  );
}
