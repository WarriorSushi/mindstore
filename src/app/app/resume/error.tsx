"use client";

import { FileText } from "lucide-react";
import { RouteError } from "@/components/RouteError";

export default function ResumeError({
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
      title="Couldn't load the resume builder"
      icon={FileText}
    />
  );
}
