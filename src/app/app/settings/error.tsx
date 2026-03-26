"use client";

import { Settings } from "lucide-react";
import { RouteError } from "@/components/RouteError";

export default function SettingsError({
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
      title="Couldn't load settings"
      icon={Settings}
    />
  );
}
