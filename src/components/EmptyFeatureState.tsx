"use client";

import Link from "next/link";
import { type LucideIcon, ArrowRight } from "lucide-react";

interface EmptyFeatureStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  ctaText?: string;
  ctaHref?: string;
  secondaryText?: string;
  secondaryHref?: string;
  /** Optional action button instead of link — e.g., "Analyze" */
  onAction?: () => void;
  actionLabel?: string;
  actionIcon?: LucideIcon;
  actionLoading?: boolean;
}

/**
 * A compelling empty-state component for plugin/analysis pages.
 *
 * Large centered Lucide icon (teal-500/20), clear headline,
 * 1–2 sentence description, primary CTA → /app/import.
 */
export function EmptyFeatureState({
  icon: Icon,
  title,
  description,
  ctaText = "Import your first data →",
  ctaHref = "/app/import",
  secondaryText,
  secondaryHref,
  onAction,
  actionLabel,
  actionIcon: ActionIcon,
  actionLoading,
}: EmptyFeatureStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-20 px-6">
      {/* Large icon */}
      <div className="mb-6">
        <Icon className="w-16 h-16 text-teal-500/20" strokeWidth={1.5} />
      </div>

      {/* Headline */}
      <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-zinc-200 mb-2">
        {title}
      </h2>

      {/* Description */}
      <p className="text-[14px] text-zinc-500 max-w-md leading-relaxed mb-8">
        {description}
      </p>

      {/* Actions */}
      <div className="flex flex-col items-center gap-3">
        {/* Optional inline action (like "Analyze") */}
        {onAction && actionLabel && (
          <button
            onClick={onAction}
            disabled={actionLoading}
            className="h-10 px-6 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-[14px]
              font-medium transition-all active:scale-[0.97] disabled:opacity-50
              flex items-center gap-2"
          >
            {actionLoading ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : ActionIcon ? (
              <ActionIcon className="w-4 h-4" />
            ) : null}
            {actionLabel}
          </button>
        )}

        {/* Primary CTA link */}
        <Link href={ctaHref}>
          <button className="h-10 px-6 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-[14px]
            font-medium transition-all active:scale-[0.97] flex items-center gap-2">
            {ctaText}
          </button>
        </Link>

        {/* Secondary text / link */}
        {secondaryText && (
          secondaryHref ? (
            <Link href={secondaryHref} className="text-[13px] text-zinc-600 hover:text-zinc-400 transition-colors">
              {secondaryText}
            </Link>
          ) : (
            <p className="text-[13px] text-zinc-600">{secondaryText}</p>
          )
        )}
      </div>
    </div>
  );
}
