"use client";

import Link from "next/link";
import { Brain, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="text-center space-y-6 px-6">
        <Brain className="w-16 h-16 text-violet-400/50 mx-auto" />
        <div>
          <h1 className="text-6xl font-bold text-zinc-200">404</h1>
          <p className="text-xl text-zinc-500 mt-2">This thought doesn't exist yet.</p>
        </div>
        <Link href="/">
          <Button variant="outline" className="border-zinc-700 hover:bg-zinc-800 gap-2">
            <ArrowLeft className="w-4 h-4" /> Back to MindStore
          </Button>
        </Link>
      </div>
    </div>
  );
}
