import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, ArrowLeft, LockKeyhole, ShieldCheck } from "lucide-react";
import { auth } from "@/server/auth";
import { isGoogleAuthConfigured, isSingleUserModeEnabled } from "@/server/identity";
import { LoginButton } from "@/components/LoginButton";
import { MindStoreLogo } from "@/components/MindStoreLogo";

interface LoginPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await auth();
  if ((session as { userId?: string } | null)?.userId) {
    redirect("/app");
  }

  const params = searchParams ? await searchParams : {};
  const reason = typeof params.reason === "string" ? params.reason : null;
  const googleConfigured = isGoogleAuthConfigured();
  const singleUserMode = isSingleUserModeEnabled();

  return (
    <main className="min-h-[100dvh] bg-[#0a0a0b] px-6 py-10 text-zinc-100">
      <div className="mx-auto flex min-h-[calc(100dvh-5rem)] max-w-5xl items-center justify-center">
        <div className="grid w-full gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-[28px] border border-white/[0.06] bg-white/[0.02] p-8 shadow-2xl shadow-black/30">
            <div className="mb-10 flex items-center gap-3">
              <MindStoreLogo className="h-10 w-10" />
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-teal-400">MindStore</p>
                <h1 className="text-[26px] font-semibold tracking-[-0.03em]">Private knowledge for every user</h1>
              </div>
            </div>

            <div className="space-y-4">
              <p className="max-w-xl text-[15px] leading-7 text-zinc-400">
                Public deployments should not run as one shared dashboard. Sign in with your own account so your memories,
                plugins, API keys, and capture history stay scoped to you.
              </p>

              {reason === "configure-auth" && (
                <div className="flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-4 text-amber-200">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                  <div>
                    <p className="text-[13px] font-medium">Authentication is required for this deployment</p>
                    <p className="mt-1 text-[12px] leading-6 text-amber-100/80">
                      `ALLOW_SINGLE_USER_MODE` is off, but Google OAuth is not fully configured yet. Add `GOOGLE_CLIENT_ID`,
                      `GOOGLE_CLIENT_SECRET`, and `AUTH_SECRET` in Vercel before inviting users in.
                    </p>
                  </div>
                </div>
              )}

              {googleConfigured ? (
                <div className="space-y-3">
                  <LoginButton />
                  <p className="text-[12px] text-zinc-500">
                    Google OAuth is enabled for this deployment. After sign-in, MindStore will scope all app data to your account.
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl border border-red-500/15 bg-red-500/[0.04] p-4">
                  <div className="flex items-start gap-3">
                    <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                    <div className="space-y-2">
                      <p className="text-[13px] font-medium text-red-200">Google sign-in is not configured yet</p>
                      <p className="text-[12px] leading-6 text-zinc-400">
                        This deployment cannot support isolated user accounts until the Google OAuth env vars are added.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link href="/" className="inline-flex items-center gap-2 text-[13px] font-medium text-zinc-400 transition hover:text-zinc-200">
                  <ArrowLeft className="h-4 w-4" />
                  Back to home
                </Link>
                <Link href="/docs/deploy/checklist" className="text-[13px] font-medium text-teal-400 transition hover:text-teal-300">
                  Deployment checklist
                </Link>
              </div>
            </div>
          </section>

          <aside className="rounded-[28px] border border-white/[0.06] bg-[#0f1012] p-8">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-zinc-500">What this means</p>
            <div className="mt-6 space-y-5">
              <div className="flex gap-3">
                <ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-teal-400" />
                <div>
                  <h2 className="text-[14px] font-semibold">One database, separate users</h2>
                  <p className="mt-1 text-[13px] leading-6 text-zinc-400">
                    MindStore uses one Postgres database. Isolation comes from authenticated `user_id` scoping on every app query,
                    not from one database per person.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-teal-400" />
                <div>
                  <h2 className="text-[14px] font-semibold">Single-user mode is only for private installs</h2>
                  <p className="mt-1 text-[13px] leading-6 text-zinc-400">
                    If this is a public URL, keep `ALLOW_SINGLE_USER_MODE=false`. Shared fallback mode is useful for local demos and
                    personal self-hosting, not for a public product.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-teal-400" />
                <div>
                  <h2 className="text-[14px] font-semibold">Auth comes first, features after</h2>
                  <p className="mt-1 text-[13px] leading-6 text-zinc-400">
                    Imports, chat, MCP, and plugins only become trustworthy once the app knows who the user is. This login flow is the
                    boundary that makes the rest of the product safe.
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-8 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 text-[12px] leading-6 text-zinc-500">
              Current deployment mode:
              <span className="ml-2 font-medium text-zinc-200">
                {googleConfigured ? "Google OAuth ready" : "OAuth missing"}
              </span>
              <span className="mx-2 text-zinc-700">·</span>
              <span className="font-medium text-zinc-200">
                {singleUserMode ? "single-user fallback on" : "single-user fallback off"}
              </span>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
