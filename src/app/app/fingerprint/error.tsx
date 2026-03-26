"use client";

import { Fingerprint } from "lucide-react";
import { RouteError } from "@/components/RouteError";

export default function FingerprintError({
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
      title="Couldn't load your fingerprint"
      icon={Fingerprint}
    />
  );
}
