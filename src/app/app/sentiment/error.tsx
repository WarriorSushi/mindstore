"use client";

import { Heart } from "lucide-react";
import { RouteError } from "@/components/RouteError";

export default function SentimentError({
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
      title="Couldn't load sentiment analysis"
      icon={Heart}
    />
  );
}
