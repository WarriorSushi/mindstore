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

/* ─── Stats Page Skeleton ─── */
export function StatsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Skeleton className="w-8 h-8 rounded-lg" />
              <Skeleton className="h-3.5 w-20" />
            </div>
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-2.5 w-28" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    </div>
  );
}

/* ─── Collection Grid Skeleton ─── */
export function CollectionSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-4 w-52" />
        </div>
        <Skeleton className="h-9 w-32 rounded-xl" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-xl" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-40" />
              </div>
            </div>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
            <div className="flex items-center gap-2 pt-1">
              <Skeleton className="h-5 w-14 rounded-full" />
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Canvas / Visualization Skeleton ─── */
export function CanvasSkeleton({ label = "Loading visualization..." }: { label?: string }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-9 w-9 rounded-xl" />
      </div>
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center">
            <div className="w-4 h-4 rounded-full border-2 border-teal-500/40 border-t-teal-400 animate-spin" />
          </div>
          <p className="text-[13px] text-zinc-500">{label}</p>
        </div>
      </div>
    </div>
  );
}

/* ─── Chat Skeleton ─── */
export function ChatSkeleton() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 space-y-4 p-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[70%] space-y-2 ${i % 2 === 0 ? "items-end" : "items-start"}`}>
              <Skeleton className={`h-16 ${i % 2 === 0 ? "w-48" : "w-64"} rounded-2xl`} />
            </div>
          </div>
        ))}
      </div>
      <div className="p-4 border-t border-white/[0.06]">
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
    </div>
  );
}

/* ─── Flashcard Skeleton ─── */
export function FlashcardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24 rounded-xl" />
          <Skeleton className="h-9 w-24 rounded-xl" />
        </div>
      </div>
      <div className="flex items-center justify-center py-12">
        <div className="w-full max-w-lg rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 space-y-4">
          <Skeleton className="h-5 w-20 mx-auto" />
          <Skeleton className="h-6 w-3/4 mx-auto" />
          <Skeleton className="h-4 w-1/2 mx-auto" />
          <div className="flex justify-center gap-3 pt-4">
            <Skeleton className="h-10 w-20 rounded-xl" />
            <Skeleton className="h-10 w-20 rounded-xl" />
            <Skeleton className="h-10 w-20 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
