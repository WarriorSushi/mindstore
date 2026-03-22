import { Brain } from "lucide-react";

export default function AppLoading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-4">
        <Brain className="w-10 h-10 text-violet-400 mx-auto animate-pulse" />
        <p className="text-zinc-500 text-sm">Loading...</p>
      </div>
    </div>
  );
}
