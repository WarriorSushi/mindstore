"use client";

import { useState, useRef, useCallback } from "react";
import {
  Plus, History, Search, X, Pin, PinOff, Clock, MessageSquare,
  Trash2, Pencil, Download, Hash, PanelLeftClose, PanelLeftOpen,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type Conversation,
  getConversation,
  deleteConversation,
  renameConversation,
  togglePinConversation,
  exportConversationMarkdown,
  getConversationStats,
  clearAllConversations,
} from "@/lib/chat-history";
import { toast } from "sonner";

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

interface ChatSidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  collapsed: boolean;
  onToggle: () => void;
  onNewChat: () => void;
  onLoadConversation: (id: string) => void;
  onRefreshHistory: () => void;
}

export function ChatSidebar({
  conversations,
  activeId,
  collapsed,
  onToggle,
  onNewChat,
  onLoadConversation,
  onRefreshHistory,
}: ChatSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const activeConversations = conversations.filter((c) => c.messages.length > 0);

  const filteredConversations = searchQuery.trim()
    ? activeConversations.filter((c) => {
        const q = searchQuery.toLowerCase().trim();
        if (c.title.toLowerCase().includes(q)) return true;
        return c.messages.some((m) => m.content.toLowerCase().includes(q));
      })
    : activeConversations;

  const handleDeleteConversation = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      deleteConversation(id);
      onRefreshHistory();
      if (activeId === id) onNewChat();
    },
    [activeId, onNewChat, onRefreshHistory]
  );

  const handlePinConversation = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const wasPinned = conversations.find((c) => c.id === id)?.pinned;
      togglePinConversation(id);
      onRefreshHistory();
      toast.success(wasPinned ? "Conversation unpinned" : "Conversation pinned");
    },
    [conversations, onRefreshHistory]
  );

  const handleExportConversation = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const convo = getConversation(id);
      if (!convo) return;
      const md = exportConversationMarkdown(convo);
      const blob = new Blob([md], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${convo.title.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "-").toLowerCase()}.md`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Conversation exported");
    },
    []
  );

  const handleClearAll = useCallback(() => {
    if (!confirm("Delete all chat history?")) return;
    clearAllConversations();
    onRefreshHistory();
    onNewChat();
    toast.success("Chat history cleared");
  }, [onRefreshHistory, onNewChat]);

  const handleRenameSubmit = useCallback(
    (id: string) => {
      const trimmed = renameValue.trim();
      if (trimmed) {
        renameConversation(id, trimmed);
        onRefreshHistory();
      }
      setRenamingId(null);
    },
    [renameValue, onRefreshHistory]
  );

  // Collapsed state — just show toggle + new chat button
  if (collapsed) {
    return (
      <div className="w-12 shrink-0 border-r border-white/[0.06] bg-[#0a0a0b] flex flex-col items-center py-3 gap-2">
        <button
          onClick={onToggle}
          className="w-8 h-8 rounded-xl flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] transition-all"
          title="Expand sidebar"
        >
          <PanelLeftOpen className="w-4 h-4" />
        </button>
        <button
          onClick={onNewChat}
          className="w-8 h-8 rounded-xl flex items-center justify-center text-zinc-500 hover:text-teal-400 hover:bg-teal-500/10 transition-all"
          title="New chat"
        >
          <Plus className="w-4 h-4" />
        </button>
        {/* Recent conversations as dots */}
        {activeConversations.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {activeConversations.slice(0, 5).map((c) => (
              <button
                key={c.id}
                onClick={() => onLoadConversation(c.id)}
                className={cn(
                  "w-8 h-8 rounded-xl flex items-center justify-center transition-all",
                  activeId === c.id
                    ? "bg-teal-500/15 text-teal-400"
                    : "text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.04]"
                )}
                title={c.title}
              >
                {c.pinned ? (
                  <Pin className="w-3.5 h-3.5" />
                ) : (
                  <MessageSquare className="w-3.5 h-3.5" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-[260px] shrink-0 border-r border-white/[0.06] bg-[#0a0a0b] flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/[0.06] shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-4 h-4 text-teal-500 shrink-0" />
          <span className="text-[13px] font-semibold text-zinc-300 tracking-[-0.01em] truncate">
            Chats
          </span>
          {activeConversations.length > 0 && (
            <span className="text-[10px] tabular-nums text-zinc-600 bg-white/[0.04] px-1.5 py-0.5 rounded-md shrink-0">
              {activeConversations.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={onNewChat}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-teal-400 hover:bg-teal-500/10 transition-all"
            title="New chat"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={onToggle}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.06] transition-all"
            title="Collapse sidebar"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search */}
      {activeConversations.length > 2 && (
        <div className="px-2.5 py-2 border-b border-white/[0.04] shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
            <input
              ref={searchRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chats…"
              className="w-full h-7 pl-8 pr-7 rounded-lg bg-white/[0.04] border border-white/[0.06] text-[12px] placeholder:text-zinc-700 focus:outline-none focus:ring-1 focus:ring-teal-500/30 focus:border-teal-500/20 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-white/[0.08]"
              >
                <X className="w-3 h-3 text-zinc-600" />
              </button>
            )}
          </div>
          {searchQuery && (
            <p className="text-[10px] text-zinc-600 mt-1 px-0.5">
              {filteredConversations.length} result{filteredConversations.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      )}

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto py-1.5 px-1.5 scroll-smooth">
        {activeConversations.length === 0 ? (
          <div className="text-center py-8 px-4">
            <MessageSquare className="w-5 h-5 text-zinc-700 mx-auto mb-2" />
            <p className="text-[12px] text-zinc-600">No conversations yet</p>
            <p className="text-[11px] text-zinc-700 mt-0.5">Start chatting to build history</p>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="text-center py-8 px-4">
            <Search className="w-5 h-5 text-zinc-700 mx-auto mb-2" />
            <p className="text-[12px] text-zinc-600">No matches</p>
            <button
              onClick={() => setSearchQuery("")}
              className="text-[11px] text-teal-400 hover:text-teal-300 mt-1 transition-colors"
            >
              Clear search
            </button>
          </div>
        ) : (
          <div className="space-y-0.5">
            {/* Pinned section */}
            {filteredConversations.some((c) => c.pinned) && (
              <div className="flex items-center gap-1.5 px-2 py-1">
                <Pin className="w-2.5 h-2.5 text-teal-500/60" />
                <span className="text-[9px] text-zinc-600 uppercase tracking-[0.08em] font-semibold">
                  Pinned
                </span>
              </div>
            )}
            {filteredConversations
              .filter((c) => c.pinned)
              .map((c) => (
                <SidebarConversationCard
                  key={c.id}
                  convo={c}
                  active={activeId === c.id}
                  renaming={renamingId === c.id}
                  renameValue={renameValue}
                  onLoad={() => onLoadConversation(c.id)}
                  onRename={(id) => {
                    setRenamingId(id);
                    setRenameValue(c.title);
                  }}
                  onRenameSubmit={() => handleRenameSubmit(c.id)}
                  onRenameCancel={() => setRenamingId(null)}
                  onRenameChange={setRenameValue}
                  onPin={(e) => handlePinConversation(c.id, e)}
                  onExport={(e) => handleExportConversation(c.id, e)}
                  onDelete={(e) => handleDeleteConversation(c.id, e)}
                />
              ))}

            {/* Unpinned section */}
            {filteredConversations.some((c) => c.pinned) &&
              filteredConversations.some((c) => !c.pinned) && (
                <div className="flex items-center gap-1.5 px-2 py-1 mt-1">
                  <Clock className="w-2.5 h-2.5 text-zinc-600" />
                  <span className="text-[9px] text-zinc-600 uppercase tracking-[0.08em] font-semibold">
                    Recent
                  </span>
                </div>
              )}
            {filteredConversations
              .filter((c) => !c.pinned)
              .map((c) => (
                <SidebarConversationCard
                  key={c.id}
                  convo={c}
                  active={activeId === c.id}
                  renaming={renamingId === c.id}
                  renameValue={renameValue}
                  onLoad={() => onLoadConversation(c.id)}
                  onRename={(id) => {
                    setRenamingId(id);
                    setRenameValue(c.title);
                  }}
                  onRenameSubmit={() => handleRenameSubmit(c.id)}
                  onRenameCancel={() => setRenamingId(null)}
                  onRenameChange={setRenameValue}
                  onPin={(e) => handlePinConversation(c.id, e)}
                  onExport={(e) => handleExportConversation(c.id, e)}
                  onDelete={(e) => handleDeleteConversation(c.id, e)}
                />
              ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {activeConversations.length > 0 && (
        <div className="px-3 py-2 border-t border-white/[0.04] shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-zinc-700 flex items-center gap-1">
              <Hash className="w-2.5 h-2.5" />
              {activeConversations.reduce((sum, c) => sum + c.messages.length, 0)} msgs
            </span>
            <button
              onClick={handleClearAll}
              className="text-[10px] text-zinc-700 hover:text-red-400 px-1.5 py-0.5 rounded hover:bg-red-500/5 transition-colors"
            >
              Clear all
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Individual conversation card */
function SidebarConversationCard({
  convo,
  active,
  renaming,
  renameValue,
  onLoad,
  onRename,
  onRenameSubmit,
  onRenameCancel,
  onRenameChange,
  onPin,
  onExport,
  onDelete,
}: {
  convo: Conversation;
  active: boolean;
  renaming: boolean;
  renameValue: string;
  onLoad: () => void;
  onRename: (id: string) => void;
  onRenameSubmit: () => void;
  onRenameCancel: () => void;
  onRenameChange: (v: string) => void;
  onPin: (e: React.MouseEvent) => void;
  onExport: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  const stats = getConversationStats(convo);

  return (
    <div
      onClick={() => {
        if (!renaming) onLoad();
      }}
      className={cn(
        "w-full text-left px-2.5 py-2 rounded-xl transition-all group flex items-start gap-2 cursor-pointer relative",
        active
          ? "bg-teal-500/10 border border-teal-500/15"
          : "hover:bg-white/[0.04] border border-transparent"
      )}
    >
      <div className="shrink-0 mt-0.5">
        {convo.pinned ? (
          <Pin className={cn("w-3 h-3", active ? "text-teal-400" : "text-teal-500/60")} />
        ) : (
          <MessageSquare className={cn("w-3 h-3", active ? "text-teal-400" : "text-zinc-600")} />
        )}
      </div>

      <div className="flex-1 min-w-0">
        {renaming ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onRenameSubmit();
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => onRenameChange(e.target.value)}
              onBlur={onRenameSubmit}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.stopPropagation();
                  onRenameCancel();
                }
              }}
              className="w-full text-[12px] bg-white/[0.06] border border-teal-500/30 rounded-lg px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-teal-500/40 text-white"
            />
          </form>
        ) : (
          <p
            className={cn(
              "text-[12px] truncate leading-snug",
              active ? "text-white font-medium" : "text-zinc-400"
            )}
            onDoubleClick={(e) => {
              e.stopPropagation();
              onRename(convo.id);
            }}
          >
            {convo.title}
          </p>
        )}
        <div className="flex items-center gap-1 mt-0.5">
          <span className="text-[10px] text-zinc-600">{formatRelativeTime(convo.updatedAt)}</span>
          <span className="text-[10px] text-zinc-700">· {stats.messageCount} msg</span>
        </div>
      </div>

      {/* Actions on hover */}
      {!renaming && (
        <div className="flex items-center gap-0 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 -mr-1">
          <button
            onClick={onPin}
            className="p-1 rounded-md hover:bg-teal-500/10 transition-all"
            title={convo.pinned ? "Unpin" : "Pin"}
          >
            {convo.pinned ? (
              <PinOff className="w-3 h-3 text-teal-400" />
            ) : (
              <Pin className="w-3 h-3 text-zinc-600" />
            )}
          </button>
          <button
            onClick={onExport}
            className="p-1 rounded-md hover:bg-white/[0.06] transition-all"
            title="Export"
          >
            <Download className="w-3 h-3 text-zinc-600" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRename(convo.id);
            }}
            className="p-1 rounded-md hover:bg-white/[0.06] transition-all"
            title="Rename"
          >
            <Pencil className="w-3 h-3 text-zinc-600" />
          </button>
          <button
            onClick={onDelete}
            className="p-1 rounded-md hover:bg-red-500/10 transition-all"
            title="Delete"
          >
            <Trash2 className="w-3 h-3 text-zinc-600 hover:text-red-400" />
          </button>
        </div>
      )}
    </div>
  );
}
