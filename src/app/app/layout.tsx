import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { getIdentityMode, isSingleUserModeEnabled } from "@/server/identity";
import { AppShell } from "@/components/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const identityMode = getIdentityMode();

  if (identityMode === "google-oauth") {
    const session = await auth();
    if (!(session as { userId?: string } | null)?.userId) {
      redirect("/login?next=%2Fapp");
    }
  } else if (!isSingleUserModeEnabled()) {
    redirect("/login?reason=configure-auth&next=%2Fapp");
  }

  return <AppShell>{children}</AppShell>;
}
