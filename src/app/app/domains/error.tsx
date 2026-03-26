"use client";

import { Globe } from "lucide-react";
import { RouteError } from "@/components/RouteError";

export default function DomainsError({
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
      title="Couldn't load your knowledge domains"
      icon={Globe}
    />
  );
}
