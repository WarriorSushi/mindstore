"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { X, Keyboard } from "lucide-react";

interface ShortcutItem {
  keys: string[];
  label: string;
}

interface ShortcutGroup {
  title: string;
  emoji: string;
  shortcuts: ShortcutItem[];
  /** Only show when on this path (null = always show) */
  path?: string | null;
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: "Global",
    emoji: "🌐",
    path: null,
    shortcuts: [
      { keys: ["⌘", "K"], label: "Open command palette" },
      { keys: ["?"], label: "Keyboard shortcuts (this modal)" },
    ],
  },
  {
    title: "Explore",
    emoji: "🧭",
    path: "/app/explore",
    shortcuts: [
      { keys: ["/"], label: "Focus search" },
      { keys: ["J"], label: "Next memory" },
      { keys: ["K"], label: "Previous memory" },
      { keys: ["↵"], label: "Open focused memory" },
      { keys: ["Esc"], label: "Close detail / exit select mode" },
      { keys: ["E"], label: "Edit memory content" },
      { keys: ["P"], label: "Pin / unpin memory" },
      { keys: ["S"], label: "Enter select mode" },
      { keys: ["␣"], label: "Toggle selection (select mode)" },
      { keys: ["A"], label: "Select / deselect all (select mode)" },
      { keys: ["↑", "↓"], label: "Navigate between memories in detail" },
      { keys: ["⌘", "↵"], label: "Save edit" },
    ],
  },
  {
    title: "Chat",
    emoji: "💬",
    path: "/app/chat",
    shortcuts: [
      { keys: ["↵"], label: "Send message" },
      { keys: ["⇧", "↵"], label: "New line in message" },
      { keys: ["Esc"], label: "Close history panel" },
    ],
  },
  {
    title: "Learn",
    emoji: "🎓",
    path: "/app/learn",
    shortcuts: [
      { keys: ["↵"], label: "Send message" },
      { keys: ["⇧", "↵"], label: "New line" },
    ],
  },
  {
    title: "Import",
    emoji: "📥",
    path: "/app/import",
    shortcuts: [
      { keys: ["↵"], label: "Submit URL import" },
    ],
  },
];

export function KeyboardShortcuts() {
  const pathname = usePathname();

  return <KeyboardShortcutsModal key={pathname} pathname={pathname} />;
}

function KeyboardShortcutsModal({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);

  // Listen for "?" key to toggle
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      // Don't trigger in inputs/textareas
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      // Don't trigger if modifier keys held (except shift for ?)
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "?") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  // Listen for custom event to open
  useEffect(() => {
    function handleCustom() {
      setOpen(true);
    }
    window.addEventListener("mindstore:open-shortcuts", handleCustom);
    return () => window.removeEventListener("mindstore:open-shortcuts", handleCustom);
  }, []);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
      }
    }
    window.addEventListener("keydown", handleKey, true);
    return () => window.removeEventListener("keydown", handleKey, true);
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  if (!open) return null;

  // Filter groups: show Global always, show page-specific group for current page, show others collapsed
  const globalGroup = SHORTCUT_GROUPS.find((g) => g.path === null)!;
  const currentPageGroup = SHORTCUT_GROUPS.find(
    (g) => g.path !== null && pathname === g.path
  );
  const otherGroups = SHORTCUT_GROUPS.filter(
    (g) => g.path !== null && g.path !== pathname
  );

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm ks-fade-in"
        onClick={close}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 max-h-[80dvh] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111113] shadow-2xl shadow-black/60 ks-scale-in flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-500/10 border border-teal-500/15 flex items-center justify-center">
              <Keyboard className="w-4 h-4 text-teal-400" />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold tracking-[-0.01em]">
                Keyboard Shortcuts
              </h2>
              <p className="text-[11px] text-zinc-600">
                Press <kbd className="font-mono bg-white/[0.06] border border-white/[0.08] rounded px-1 py-[1px] text-[10px] text-zinc-400">?</kbd> to toggle
              </p>
            </div>
          </div>
          <button
            onClick={close}
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-4 h-4 text-zinc-500" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto px-5 py-4 space-y-5 flex-1">
          {/* Global shortcuts */}
          <ShortcutSection group={globalGroup} />

          {/* Current page shortcuts (highlighted) */}
          {currentPageGroup && (
            <ShortcutSection group={currentPageGroup} highlighted />
          )}

          {/* Other page shortcuts */}
          {otherGroups.map((group) => (
            <ShortcutSection key={group.title} group={group} />
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/[0.06] shrink-0 flex items-center justify-between">
          <p className="text-[10px] text-zinc-600">
            Shortcuts are desktop-only
          </p>
          <button
            onClick={close}
            className="text-[11px] text-zinc-500 hover:text-zinc-300 font-medium px-2.5 py-1 rounded-lg hover:bg-white/[0.06] transition-colors"
          >
            Close <span className="ml-1 font-mono text-[10px] text-zinc-600">Esc</span>
          </button>
        </div>
      </div>

      {/* CSS Animations */}
      <style>{`
        .ks-fade-in {
          animation: ks-fade 150ms ease-out both;
        }
        .ks-scale-in {
          animation: ks-scale 200ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @keyframes ks-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes ks-scale {
          from { opacity: 0; transform: scale(0.95) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}

/** Render a single group of shortcuts */
function ShortcutSection({
  group,
  highlighted = false,
}: {
  group: ShortcutGroup;
  highlighted?: boolean;
}) {
  return (
    <div>
      {/* Section header */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm leading-none">{group.emoji}</span>
        <span
          className={`text-[11px] font-semibold uppercase tracking-[0.06em] ${
            highlighted ? "text-teal-400" : "text-zinc-500"
          }`}
        >
          {group.title}
        </span>
        {highlighted && (
          <span className="text-[9px] px-1.5 py-[2px] rounded-md bg-teal-500/10 text-teal-400 border border-teal-500/15 font-semibold">
            Current page
          </span>
        )}
      </div>

      {/* Shortcuts list */}
      <div
        className={`rounded-xl border overflow-hidden divide-y ${
          highlighted
            ? "border-teal-500/15 divide-teal-500/10 bg-teal-500/[0.03]"
            : "border-white/[0.06] divide-white/[0.04] bg-white/[0.02]"
        }`}
      >
        {group.shortcuts.map((shortcut, i) => (
          <div
            key={i}
            className="flex items-center justify-between px-3.5 py-2 hover:bg-white/[0.02] transition-colors"
          >
            <span className="text-[12px] text-zinc-400">{shortcut.label}</span>
            <div className="flex items-center gap-1">
              {shortcut.keys.map((key, ki) => (
                <kbd
                  key={ki}
                  className={`inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-md text-[11px] font-mono font-medium ${
                    highlighted
                      ? "bg-teal-500/10 border border-teal-500/20 text-teal-300"
                      : "bg-white/[0.06] border border-white/[0.08] text-zinc-300"
                  }`}
                >
                  {key}
                </kbd>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Exported open function via custom event */
export function openKeyboardShortcuts() {
  window.dispatchEvent(new CustomEvent("mindstore:open-shortcuts"));
}
