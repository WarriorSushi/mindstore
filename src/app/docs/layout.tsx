import type { ReactNode } from "react";
import { DocsShell } from "@/components/docs/DocsShell";
import { getDocsNavigation } from "@/lib/docs";

export const dynamic = "force-static";

export default async function DocsLayout({ children }: { children: ReactNode }) {
  const navigation = await getDocsNavigation();

  return <DocsShell navigation={navigation}>{children}</DocsShell>;
}
