/**
 * Chat history persistence via localStorage.
 * Stores conversations so users don't lose them on navigation.
 */

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: { title: string; type: string; score: number }[];
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = "mindstore-chat-history";
const MAX_CONVERSATIONS = 50;

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/** Get all conversations, newest first */
export function getConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const convos: Conversation[] = JSON.parse(raw);
    return convos.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
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
  };
  convos.unshift(newConvo);
  // Trim old conversations
  if (convos.length > MAX_CONVERSATIONS) {
    convos.length = MAX_CONVERSATIONS;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(convos));
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

/** Delete all conversations */
export function clearAllConversations(): void {
  localStorage.removeItem(STORAGE_KEY);
}
