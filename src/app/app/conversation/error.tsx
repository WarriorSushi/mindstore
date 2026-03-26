"use client";

import { MessageCircle } from "lucide-react";
import { RouteError } from "@/components/RouteError";

export default function ConversationError({
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
      title="Couldn't load this conversation"
      icon={MessageCircle}
    />
  );
}
