/**
 * Shared source type configuration — icons, colors, labels
 * 
 * Single source of truth for how memory source types are displayed
 * across the entire app: dashboard, chat, explore, import, etc.
 */

import {
  MessageCircle,
  FileText,
  Globe,
  Type,
  BookOpen,
  FileBox,
  PlayCircle,
  Bookmark,
  Gem,
  MessageSquare,
  Mic,
  Camera,
  StickyNote,
  AtSign,
  Send,
  BookmarkCheck,
  Music,
  Highlighter,
  Hash,
  type LucideIcon,
} from "lucide-react";

export interface SourceTypeConfig {
  icon: LucideIcon;
  /** Tailwind classes for text color only, e.g. "text-green-400" */
  textColor: string;
  /** Tailwind classes for background only, e.g. "bg-green-500/10" */
  bgColor: string;
  /** Tailwind classes for border only, e.g. "border-green-500/15" */
  borderColor: string;
  /** Combined text + bg classes for badges */
  badgeClasses: string;
  /** Human-readable label */
  label: string;
  /** Short 2-4 char label for compact displays */
  shortLabel: string;
}

const SOURCE_TYPES: Record<string, SourceTypeConfig> = {
  chatgpt: {
    icon: MessageCircle,
    textColor: "text-green-400",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/15",
    badgeClasses: "text-green-400 bg-green-500/10",
    label: "ChatGPT",
    shortLabel: "GPT",
  },
  file: {
    icon: FileText,
    textColor: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/15",
    badgeClasses: "text-blue-400 bg-blue-500/10",
    label: "File",
    shortLabel: "FILE",
  },
  url: {
    icon: Globe,
    textColor: "text-orange-400",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/15",
    badgeClasses: "text-orange-400 bg-orange-500/10",
    label: "URL",
    shortLabel: "URL",
  },
  text: {
    icon: Type,
    textColor: "text-teal-400",
    bgColor: "bg-teal-500/10",
    borderColor: "border-teal-500/15",
    badgeClasses: "text-teal-400 bg-teal-500/10",
    label: "Text",
    shortLabel: "TXT",
  },
  kindle: {
    icon: BookOpen,
    textColor: "text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/15",
    badgeClasses: "text-amber-400 bg-amber-500/10",
    label: "Kindle",
    shortLabel: "KDL",
  },
  document: {
    icon: FileBox,
    textColor: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/15",
    badgeClasses: "text-blue-400 bg-blue-500/10",
    label: "Document",
    shortLabel: "DOC",
  },
  youtube: {
    icon: PlayCircle,
    textColor: "text-red-400",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/15",
    badgeClasses: "text-red-400 bg-red-500/10",
    label: "YouTube",
    shortLabel: "YT",
  },
  bookmark: {
    icon: Bookmark,
    textColor: "text-sky-400",
    bgColor: "bg-sky-500/10",
    borderColor: "border-sky-500/15",
    badgeClasses: "text-sky-400 bg-sky-500/10",
    label: "Bookmark",
    shortLabel: "BKM",
  },
  obsidian: {
    icon: Gem,
    textColor: "text-teal-400",
    bgColor: "bg-teal-500/10",
    borderColor: "border-teal-500/15",
    badgeClasses: "text-teal-400 bg-teal-500/10",
    label: "Obsidian",
    shortLabel: "OBS",
  },
  reddit: {
    icon: MessageSquare,
    textColor: "text-orange-400",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/15",
    badgeClasses: "text-orange-400 bg-orange-500/10",
    label: "Reddit",
    shortLabel: "RDT",
  },
  audio: {
    icon: Mic,
    textColor: "text-teal-400",
    bgColor: "bg-teal-500/10",
    borderColor: "border-teal-500/15",
    badgeClasses: "text-teal-400 bg-teal-500/10",
    label: "Audio",
    shortLabel: "AUD",
  },
  image: {
    icon: Camera,
    textColor: "text-sky-400",
    bgColor: "bg-sky-500/10",
    borderColor: "border-sky-500/15",
    badgeClasses: "text-sky-400 bg-sky-500/10",
    label: "Image",
    shortLabel: "IMG",
  },
  notion: {
    icon: StickyNote,
    textColor: "text-zinc-300",
    bgColor: "bg-zinc-500/10",
    borderColor: "border-zinc-500/15",
    badgeClasses: "text-zinc-300 bg-zinc-500/10",
    label: "Notion",
    shortLabel: "NTN",
  },
  twitter: {
    icon: AtSign,
    textColor: "text-sky-400",
    bgColor: "bg-sky-500/10",
    borderColor: "border-sky-500/15",
    badgeClasses: "text-sky-400 bg-sky-500/10",
    label: "Twitter",
    shortLabel: "X",
  },
  telegram: {
    icon: Send,
    textColor: "text-teal-400",
    bgColor: "bg-teal-500/10",
    borderColor: "border-teal-500/15",
    badgeClasses: "text-teal-400 bg-teal-500/10",
    label: "Telegram",
    shortLabel: "TG",
  },
  pocket: {
    icon: BookmarkCheck,
    textColor: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/15",
    badgeClasses: "text-emerald-400 bg-emerald-500/10",
    label: "Pocket",
    shortLabel: "PKT",
  },
  instapaper: {
    icon: BookmarkCheck,
    textColor: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/15",
    badgeClasses: "text-emerald-400 bg-emerald-500/10",
    label: "Instapaper",
    shortLabel: "INS",
  },
  spotify: {
    icon: Music,
    textColor: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/15",
    badgeClasses: "text-emerald-400 bg-emerald-500/10",
    label: "Spotify",
    shortLabel: "SPT",
  },
  readwise: {
    icon: Highlighter,
    textColor: "text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/15",
    badgeClasses: "text-amber-400 bg-amber-500/10",
    label: "Readwise",
    shortLabel: "RW",
  },
};

/** Default config for unknown source types */
const DEFAULT_SOURCE: SourceTypeConfig = {
  icon: Hash,
  textColor: "text-zinc-400",
  bgColor: "bg-zinc-500/10",
  borderColor: "border-zinc-500/15",
  badgeClasses: "text-zinc-400 bg-zinc-500/10",
  label: "Unknown",
  shortLabel: "???",
};

/**
 * Get source type configuration for a given type string.
 * Returns default config for unknown types instead of crashing.
 */
export function getSourceType(type: string | undefined | null): SourceTypeConfig {
  if (!type) return DEFAULT_SOURCE;
  return SOURCE_TYPES[type] || DEFAULT_SOURCE;
}

/**
 * Get the icon component for a source type.
 */
export function getSourceIcon(type: string | undefined | null): LucideIcon {
  return getSourceType(type).icon;
}

/**
 * Get all source types (useful for filter dropdowns, etc.)
 */
export function getAllSourceTypes(): Array<{ type: string } & SourceTypeConfig> {
  return Object.entries(SOURCE_TYPES).map(([type, config]) => ({
    type,
    ...config,
  }));
}

/**
 * Check if a source type is known
 */
export function isKnownSourceType(type: string): boolean {
  return type in SOURCE_TYPES;
}

export { SOURCE_TYPES };
