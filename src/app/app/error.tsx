"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("MindStore app error:", error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-6 px-6 max-w-md">
        <AlertTriangle className="w-12 h-12 text-amber-400/70 mx-auto" />
        <div>
          <h2 className="text-2xl font-semibold text-zinc-200">Something went wrong</h2>
          <p className="text-zinc-500 mt-2 text-sm">
            {error.message || "An unexpected error occurred. Your data is safe."}
          </p>
        </div>
        <Button
          onClick={reset}
          variant="outline"
          className="border-zinc-700 hover:bg-zinc-800 gap-2"
        >
          <RotateCcw className="w-4 h-4" /> Try Again
        </Button>
      </div>
    </div>
  );
}
