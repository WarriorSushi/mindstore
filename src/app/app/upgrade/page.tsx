'use client';

import { Zap, Check, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { PageTransition } from '@/components/PageTransition';
import { usePageTitle } from '@/lib/use-page-title';
import { TIERS, PRO_PRICE_USD } from '@/lib/tiers';

const FREE_FEATURES = [
  `${TIERS.free.maxMemories.toLocaleString()} memories`,
  `${TIERS.free.maxSources} import sources`,
  `${TIERS.free.maxAiQueriesPerDay} AI queries / day`,
  `${TIERS.free.maxFlashcardDecks} flashcard decks`,
  'Knowledge Fingerprint',
  'MCP integration',
  'All 35+ import plugins',
];

const PRO_FEATURES = [
  'Unlimited memories',
  'Unlimited AI queries',
  'Unlimited import sources',
  'Unlimited flashcard decks',
  '.mind file export',
  'Priority support',
  'Early access to new features',
  'Team workspaces (coming soon)',
];

export default function UpgradePage() {
  usePageTitle('Upgrade to Pro');

  return (
    <PageTransition>
      <div className="max-w-2xl mx-auto space-y-8 py-4">
        <div>
          <h1 className="text-[22px] md:text-[28px] font-semibold tracking-[-0.03em]">Upgrade to Pro</h1>
          <p className="text-[13px] text-zinc-500 mt-0.5">Unlimited everything. One flat price.</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {/* Free tier */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-zinc-600 mb-3">Free</p>
            <p className="text-[32px] font-bold tracking-[-0.04em] text-zinc-200">$0</p>
            <p className="text-[12px] text-zinc-600 mt-0.5 mb-5">forever</p>
            <ul className="space-y-2.5">
              {FREE_FEATURES.map(f => (
                <li key={f} className="flex items-center gap-2.5 text-[12px] text-zinc-400">
                  <Check className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Pro tier */}
          <div className="relative rounded-2xl border border-teal-500/20 bg-teal-500/[0.04] p-6 overflow-hidden">
            <div className="absolute top-4 right-4">
              <span className="px-2 py-0.5 rounded-md bg-teal-500/15 border border-teal-500/20 text-[10px] font-bold uppercase tracking-[0.1em] text-teal-400">
                Popular
              </span>
            </div>
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-teal-500 mb-3">Pro</p>
            <p className="text-[32px] font-bold tracking-[-0.04em] text-zinc-100">
              ${PRO_PRICE_USD}
              <span className="text-[16px] text-zinc-500 font-normal">/mo</span>
            </p>
            <p className="text-[12px] text-zinc-600 mt-0.5 mb-5">billed monthly</p>
            <ul className="space-y-2.5 mb-6">
              {PRO_FEATURES.map(f => (
                <li key={f} className="flex items-center gap-2.5 text-[12px] text-zinc-300">
                  <Check className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <button
              disabled
              className="w-full h-11 rounded-xl bg-teal-600/50 text-teal-200/60 text-[13px] font-semibold cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4" />
              Coming soon
            </button>
            <p className="text-[10px] text-zinc-700 text-center mt-2">Payments via Dodo — launching soon</p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.04] bg-white/[0.01] p-5">
          <div className="flex items-start gap-3">
            <Zap className="w-4 h-4 text-zinc-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-[12px] text-zinc-500 leading-relaxed">
                MindStore is free and open source. Pro helps keep the lights on and funds development.
                All core features stay free forever — Pro is for power users who want unlimited scale.
              </p>
              <Link href="https://github.com/mindstore-org/mindstore" target="_blank" className="inline-flex items-center gap-1 mt-2 text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors">
                View on GitHub <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
