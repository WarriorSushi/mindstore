"use client";

import { Mic } from "lucide-react";
import { RouteError } from "@/components/RouteError";

export default function VoiceError({
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
      title="Couldn't load voice features"
      icon={Mic}
    />
  );
}
