"use client";

import { Map } from "lucide-react";
import { RouteError } from "@/components/RouteError";

export default function PathsError({
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
      title="Couldn't load learning paths"
      icon={Map}
    />
  );
}
