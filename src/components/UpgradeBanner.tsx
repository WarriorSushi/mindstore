'use client';

import Link from 'next/link';
import { Zap, X } from 'lucide-react';
import { useState } from 'react';
import { TIERS, PRO_PRICE_USD } from '@/lib/tiers';

interface UpgradeBannerProps {
  /** Resource name for context copy */
  resource: 'memories' | 'ai queries' | 'sources';
  /** How many used */
  used: number;
  /** Free tier limit */
  limit: number;
  /** Whether they've hit the hard limit (vs. approaching it) */
  atLimit?: boolean;
  className?: string;
}

export function UpgradeBanner({ resource, used, limit, atLimit = false, className = '' }: UpgradeBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const pct = Math.min(100, Math.round((used / limit) * 100));

  return (
    <div className={`relative flex items-start gap-3 rounded-2xl border px-4 py-3.5 ${
      atLimit
        ? 'bg-red-500/[0.05] border-red-500/15'
        : 'bg-amber-500/[0.05] border-amber-500/15'
    } ${className}`}>
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
        atLimit ? 'bg-red-500/15' : 'bg-amber-500/15'
      }`}>
        <Zap className={`w-3.5 h-3.5 ${atLimit ? 'text-red-400' : 'text-amber-400'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-[13px] font-medium ${atLimit ? 'text-red-300' : 'text-amber-300'}`}>
          {atLimit
            ? `${resource} limit reached`
            : `${pct}% of free ${resource} used`}
        </p>
        <p className={`text-[11px] mt-0.5 leading-relaxed ${atLimit ? 'text-red-400/70' : 'text-amber-400/60'}`}>
          {atLimit
            ? `Free plan allows ${limit.toLocaleString()} ${resource}. Upgrade to Pro for unlimited.`
            : `${used.toLocaleString()} of ${limit.toLocaleString()} used. Upgrade before you hit the limit.`}
        </p>
        <Link
          href="/app/upgrade"
          className={`inline-flex items-center gap-1.5 mt-2 text-[12px] font-semibold transition-colors ${
            atLimit ? 'text-red-300 hover:text-red-200' : 'text-amber-300 hover:text-amber-200'
          }`}
        >
          <Zap className="w-3 h-3" />
          Upgrade to Pro — ${PRO_PRICE_USD}/mo →
        </Link>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-3 right-3 text-zinc-600 hover:text-zinc-400 transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

/** Inline compact version for use inside cards */
export function UpgradeNudge({ href = '/app/upgrade' }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1.5 text-[11px] text-amber-400/80 hover:text-amber-300 transition-colors">
      <Zap className="w-3 h-3" />
      Upgrade for unlimited
    </Link>
  );
}
