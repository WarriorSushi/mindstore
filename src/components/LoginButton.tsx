"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Loader2, LogIn } from "lucide-react";

export function LoginButton() {
  const params = useSearchParams();
  const [pending, setPending] = useState(false);
  const callbackUrl = useMemo(() => params.get("next") || "/app", [params]);

  async function handleSignIn() {
    setPending(true);
    try {
      await signIn("google", { callbackUrl });
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      onClick={handleSignIn}
      disabled={pending}
      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-teal-500 px-5 text-[14px] font-semibold text-white transition hover:bg-teal-400 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
      Continue with Google
    </button>
  );
}
