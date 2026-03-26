"use client";

import { Newspaper } from "lucide-react";
import { RouteError } from "@/components/RouteError";

export default function NewsletterError({
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
      title="Couldn't load the newsletter generator"
      icon={Newspaper}
    />
  );
}
