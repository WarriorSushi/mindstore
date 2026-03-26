"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { DocNavGroup } from "@/lib/docs";

interface DocsShellProps {
  children: ReactNode;
  navigation: DocNavGroup[];
}

export function DocsShell({ children, navigation }: DocsShellProps) {
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const filteredNavigation = navigation
    .map((group) => {
      if (!normalizedQuery) {
        return group;
      }

      const labelMatches = group.label.toLowerCase().includes(normalizedQuery);
      if (labelMatches) {
        return group;
      }

      return {
        ...group,
        items: group.items.filter((item) => item.title.toLowerCase().includes(normalizedQuery)),
      };
    })
    .filter((group) => group.items.length > 0);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="border-b border-white/[0.06] bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <Link href="/docs" className="text-[18px] font-semibold tracking-[-0.03em]">
              MindStore Docs
            </Link>
            <p className="mt-1 text-[12px] text-zinc-500">
              Documentation for users, builders, and future contributors.
            </p>
          </div>
          <div className="flex items-center gap-2 text-[12px]">
            <Link
              href="/docs/getting-started/quickstart"
              className="rounded-full border border-white/[0.08] px-3 py-1.5 text-zinc-300 transition-colors hover:border-teal-500/30 hover:text-teal-300"
            >
              Quickstart
            </Link>
            <Link
              href="/docs/build"
              className="rounded-full border border-white/[0.08] px-3 py-1.5 text-zinc-300 transition-colors hover:border-sky-500/30 hover:text-sky-300"
            >
              Build
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-8 sm:px-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:px-8">
        <aside className="space-y-6">
          <div className="rounded-[24px] border border-white/[0.06] bg-white/[0.02] p-3">
            <label className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
              Search Docs
            </label>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search pages"
              className="mt-2 w-full rounded-2xl border border-white/[0.08] bg-zinc-950 px-3 py-2 text-[13px] text-zinc-100 outline-none transition-colors placeholder:text-zinc-500 focus:border-teal-500/40"
            />
          </div>

          {filteredNavigation.map((group) => (
            <div key={group.key} className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
                {group.label}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`block rounded-xl px-3 py-2 text-[13px] transition-colors ${
                        active
                          ? "bg-teal-500/10 text-teal-300"
                          : "text-zinc-400 hover:bg-white/[0.03] hover:text-zinc-100"
                      }`}
                    >
                      {item.title}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}

          {filteredNavigation.length === 0 && (
            <div className="rounded-[24px] border border-dashed border-white/[0.08] bg-white/[0.02] px-4 py-5 text-[13px] text-zinc-400">
              No documentation pages matched that search.
            </div>
          )}
        </aside>

        <main>{children}</main>
      </div>
    </div>
  );
}
