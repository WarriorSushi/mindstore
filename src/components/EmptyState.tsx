"use client";

import Link from "next/link";
import { type LucideIcon, ChevronRight } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    href: string;
  };
  secondaryAction?: {
    label: string;
    href: string;
  };
  color?: "teal" | "sky" | "amber" | "emerald" | "blue";
  compact?: boolean;
}

const colorMap = {
  teal: {
    iconBg: "bg-teal-500/15",
    iconText: "text-teal-400",
    border: "border-teal-500/20",
    gradient: "from-teal-500/[0.06] to-teal-500/[0.02]",
    button: "bg-teal-600 hover:bg-teal-500",
  },
  sky: {
    iconBg: "bg-sky-500/15",
    iconText: "text-sky-400",
    border: "border-sky-500/20",
    gradient: "from-sky-500/[0.06] to-sky-500/[0.02]",
    button: "bg-sky-600 hover:bg-sky-500",
  },
  amber: {
    iconBg: "bg-amber-500/15",
    iconText: "text-amber-400",
    border: "border-amber-500/20",
    gradient: "from-amber-500/[0.06] to-amber-500/[0.02]",
    button: "bg-amber-600 hover:bg-amber-500",
  },
  emerald: {
    iconBg: "bg-emerald-500/15",
    iconText: "text-emerald-400",
    border: "border-emerald-500/20",
    gradient: "from-emerald-500/[0.06] to-emerald-500/[0.02]",
    button: "bg-emerald-600 hover:bg-emerald-500",
  },
  blue: {
    iconBg: "bg-blue-500/15",
    iconText: "text-blue-400",
    border: "border-blue-500/20",
    gradient: "from-blue-500/[0.06] to-blue-500/[0.02]",
    button: "bg-blue-600 hover:bg-blue-500",
  },
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  color = "teal",
  compact = false,
}: EmptyStateProps) {
  const c = colorMap[color];

  return (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? "py-8" : "min-h-[50dvh]"}`}>
      <div className={`w-14 h-14 rounded-2xl ${c.iconBg} flex items-center justify-center mb-4`}>
        <Icon className={`w-6 h-6 ${c.iconText}`} />
      </div>
      <h2 className="text-[16px] font-semibold tracking-[-0.01em] mb-1.5">{title}</h2>
      <p className="text-[13px] text-zinc-500 max-w-sm leading-relaxed mb-6">{description}</p>
      <div className="flex items-center gap-3">
        {action && (
          <Link href={action.href}>
            <button className={`h-9 px-5 rounded-xl ${c.button} text-[13px] font-medium text-white transition-all active:scale-[0.96]`}>
              {action.label}
            </button>
          </Link>
        )}
        {secondaryAction && (
          <Link href={secondaryAction.href}>
            <button className="h-9 px-4 rounded-xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] text-[13px] text-zinc-400 font-medium transition-all active:scale-[0.96] flex items-center gap-1.5">
              {secondaryAction.label}
              <ChevronRight className="w-3 h-3" />
            </button>
          </Link>
        )}
      </div>
    </div>
  );
}

/* ─── Skeleton Loader ─── */

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div className={`animate-pulse rounded-xl bg-white/[0.04] ${className}`} />
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-16" />
      <Skeleton className="h-3 w-32" />
    </div>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-48" />
            <Skeleton className="h-3 w-72" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
      <ListSkeleton rows={3} />
    </div>
  );
}
