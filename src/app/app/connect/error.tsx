"use client";

import { Link2 } from "lucide-react";
import { RouteError } from "@/components/RouteError";

export default function ConnectError({
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
      title="Couldn't load MCP connections"
      icon={Link2}
    />
  );
}
