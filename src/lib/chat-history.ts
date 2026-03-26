/**
 * Chat history persistence via localStorage.
 * Stores conversations so users don't lose them on navigation.
 */

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: { title: string; type: string; score: number; id?: string; preview?: string; content?: string }[];
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
  pinned?: boolean;
}

const STORAGE_KEY = "mindstore-chat-history";
const MAX_CONVERSATIONS = 50;

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/** Sort: pinned first (by updatedAt), then unpinned (by updatedAt) */
function sortConversations(convos: Conversation[]): Conversation[] {
  const pinned = convos.filter(c => c.pinned).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const unpinned = convos.filter(c => !c.pinned).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return [...pinned, ...unpinned];
}

/** Get all conversations, pinned first then newest first */
export function getConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const convos: Conversation[] = JSON.parse(raw);
    return sortConversations(convos);
  } catch {
    return [];
  }
}

/** Get a single conversation by ID */
export function getConversation(id: string): Conversation | null {
  const convos = getConversations();
  return convos.find((c) => c.id === id) || null;
}

/** Create a new conversation, returns its ID */
export function createConversation(): string {
  const convos = getConversations();
  const newConvo: Conversation = {
    id: generateId(),
    title: "New chat",
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    pinned: false,
  };
  convos.unshift(newConvo);
  // Trim old conversations (never trim pinned)
  const pinned = convos.filter(c => c.pinned);
  const unpinned = convos.filter(c => !c.pinned);
  if (unpinned.length > MAX_CONVERSATIONS - pinned.length) {
    unpinned.length = MAX_CONVERSATIONS - pinned.length;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...pinned, ...unpinned]));
  return newConvo.id;
}

/** Generate a short title from the first user message */
function generateTitle(messages: ChatMessage[]): string {
  const firstUser = messages.find((m) => m.role === "user");
  if (!firstUser) return "New chat";
  const text = firstUser.content.trim();
  if (text.length <= 40) return text;
  return text.slice(0, 40).trim() + "…";
}

/** Save messages to a conversation */
export function saveConversation(id: string, messages: ChatMessage[]): void {
  const convos = getConversations();
  const idx = convos.findIndex((c) => c.id === id);
  if (idx === -1) return;
  convos[idx].messages = messages;
  convos[idx].updatedAt = new Date().toISOString();
  convos[idx].title = generateTitle(messages);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(convos));
}

/** Delete a conversation */
export function deleteConversation(id: string): void {
  const convos = getConversations().filter((c) => c.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(convos));
}

/** Rename a conversation */
export function renameConversation(id: string, title: string): void {
  const convos = getConversations();
  const idx = convos.findIndex((c) => c.id === id);
  if (idx === -1) return;
  convos[idx].title = title.trim() || "Untitled";
  localStorage.setItem(STORAGE_KEY, JSON.stringify(convos));
}

/** Toggle pin status of a conversation */
export function togglePinConversation(id: string): boolean {
  const convos = getConversations();
  const idx = convos.findIndex((c) => c.id === id);
  if (idx === -1) return false;
  convos[idx].pinned = !convos[idx].pinned;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(convos));
  return convos[idx].pinned!;
}

/** Search conversations by title and message content */
export function searchConversations(query: string): Conversation[] {
  if (!query.trim()) return getConversations();
  const q = query.toLowerCase().trim();
  const convos = getConversations();
  return convos.filter(c => {
    if (c.title.toLowerCase().includes(q)) return true;
    return c.messages.some(m => m.content.toLowerCase().includes(q));
  });
}

/** Export a conversation as formatted markdown */
export function exportConversationMarkdown(convo: Conversation): string {
  const lines: string[] = [];
  lines.push(`# ${convo.title}`);
  lines.push('');
  lines.push(`> Exported from MindStore · ${new Date(convo.createdAt).toLocaleDateString()} · ${convo.messages.length} messages`);
  lines.push('');
  lines.push('---');
  lines.push('');
  for (const msg of convo.messages) {
    if (msg.role === 'user') {
      lines.push(`### 🧑 You`);
    } else {
      lines.push(`### 🧠 MindStore`);
    }
    lines.push('');
    lines.push(msg.content);
    if (msg.sources && msg.sources.length > 0) {
      lines.push('');
      lines.push('**Sources:**');
      for (const s of msg.sources) {
        lines.push(`- ${s.title} (${s.type}, ${Math.round(s.score * 100)}% match)`);
      }
    }
    lines.push('');
    lines.push('---');
    lines.push('');
  }
  return lines.join('\n');
}

/** Get conversation stats */
export function getConversationStats(convo: Conversation): { messageCount: number; wordCount: number; userMessages: number; aiMessages: number } {
  const userMessages = convo.messages.filter(m => m.role === 'user').length;
  const aiMessages = convo.messages.filter(m => m.role === 'assistant').length;
  const wordCount = convo.messages.reduce((sum, m) => sum + m.content.split(/\s+/).filter(Boolean).length, 0);
  return { messageCount: convo.messages.length, wordCount, userMessages, aiMessages };
}

/** Delete all conversations */
export function clearAllConversations(): void {
  localStorage.removeItem(STORAGE_KEY);
}
