"use client";

import { Eye } from "lucide-react";
import { RouteError } from "@/components/RouteError";

export default function VisionError({
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
      title="Couldn't load the vision board"
      icon={Eye}
    />
  );
}
