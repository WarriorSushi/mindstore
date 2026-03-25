import { notFound } from "next/navigation";
import { getDocBySlug } from "@/lib/docs";

export const dynamic = "force-static";

export default async function DocsHomePage() {
  const doc = await getDocBySlug([]);

  if (!doc) {
    notFound();
  }

  return (
    <article className="docs-prose max-w-4xl rounded-[28px] border border-white/[0.06] bg-white/[0.02] px-6 py-8 sm:px-8">
      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-teal-400">
          Documentation
        </p>
        <h1 className="mt-2 text-[32px] font-semibold tracking-[-0.04em] text-white">{doc.title}</h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-7 text-zinc-400">{doc.description}</p>
      </div>
      <div dangerouslySetInnerHTML={{ __html: doc.html }} />
    </article>
  );
}
