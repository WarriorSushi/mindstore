import { Brain } from "lucide-react";

export default function Loading() {
  return (
    <div className="min-h-screen bg-[#0a0a0b] flex flex-col items-center justify-center gap-4">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-500/20 to-sky-500/10 flex items-center justify-center ring-1 ring-teal-500/10">
        <Brain className="w-6 h-6 text-teal-400 animate-pulse" />
      </div>
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-teal-500/40 animate-pulse"
            style={{ animationDelay: `${i * 200}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
