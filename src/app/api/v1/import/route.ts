import JSZip from "jszip";
import { NextRequest, NextResponse } from "next/server";
import { importDocuments, type ImportDocument } from "@/server/import-service";
import { getUserId } from "@/server/user";

interface ChatGptExportConversation {
  title?: string;
  create_time?: number;
  mapping?: Record<
    string,
    {
      parent?: string;
      children?: string[];
      message?: {
        author?: { role?: string };
        content?: { parts?: unknown[] };
      };
    }
  >;
}

function cleanTitle(filename: string): string {
  return (
    filename
      .replace(/^.*[\/\\]/, "")
      .replace(/\.(md|txt|markdown)$/i, "")
      .replace(/\s+[a-f0-9]{20,}$/i, "")
      .replace(/\s+[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i, "")
      .trim() || filename
  );
}

function parseChatGPT(json: unknown): ImportDocument[] {
  if (!Array.isArray(json)) {
    return [];
  }

  const conversations = json as ChatGptExportConversation[];
  const results: ImportDocument[] = [];

  for (const conversation of conversations) {
    const title = conversation.title || "Untitled Conversation";
    const messages: string[] = [];

    if (conversation.mapping) {
      const visited = new Set<string>();
      const walk = (nodeId: string) => {
        if (visited.has(nodeId)) {
          return;
        }

        visited.add(nodeId);
        const node = conversation.mapping?.[nodeId];
        if (!node) {
          return;
        }

        const parts = node.message?.content?.parts;
        if (Array.isArray(parts)) {
          const role = node.message?.author?.role || "unknown";
          const text = parts.filter((part): part is string => typeof part === "string").join("\n");
          if (text.trim() && role !== "system") {
            messages.push(`${role}: ${text}`);
          }
        }

        for (const childId of node.children || []) {
          walk(childId);
        }
      };

      for (const [id, node] of Object.entries(conversation.mapping)) {
        if (!node.parent || !conversation.mapping[node.parent]) {
          walk(id);
        }
      }
    }

    if (messages.length > 0) {
      results.push({
        title,
        content: messages.join("\n\n"),
        sourceType: "chatgpt",
        contentType: "conversation",
        timestamp: new Date((conversation.create_time || 0) * 1000),
      });
    }
  }

  return results;
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId();
    const documents = await parseImportRequest(req);
    const imported = await importDocuments({ userId, documents });

    return NextResponse.json({ imported });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message === "No documents to import" ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

async function parseImportRequest(req: NextRequest): Promise<ImportDocument[]> {
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    return parseMultipartImportRequest(req);
  }

  return parseJsonImportRequest(req);
}

async function parseMultipartImportRequest(req: NextRequest): Promise<ImportDocument[]> {
  const formData = await req.formData();
  const sourceType = (formData.get("source_type") as string) || "text";
  const files = formData.getAll("files") as File[];
  const documents: ImportDocument[] = [];

  for (const file of files) {
    const isZip =
      file.name.endsWith(".zip") ||
      file.type === "application/zip" ||
      file.type === "application/x-zip-compressed";

    if (isZip) {
      const buffer = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(buffer);

      for (const [filename, zipEntry] of Object.entries(zip.files)) {
        if (zipEntry.dir) {
          continue;
        }

        const entryText = await zipEntry.async("text");

        if (filename.endsWith(".json") && (sourceType === "chatgpt" || filename.includes("conversations"))) {
          try {
            documents.push(...parseChatGPT(JSON.parse(entryText)));
          } catch {
            continue;
          }
          continue;
        }

        if (filename.endsWith(".md") || filename.endsWith(".txt")) {
          documents.push({
            title: cleanTitle(filename),
            content: entryText,
            sourceType: sourceType || "file",
            contentType: "document",
          });
        }
      }

      continue;
    }

    const text = await file.text();
    if (sourceType === "chatgpt" && file.name.endsWith(".json")) {
      documents.push(...parseChatGPT(JSON.parse(text)));
      continue;
    }

    documents.push({
      title: cleanTitle(file.name),
      content: text,
      sourceType,
      contentType: "document",
    });
  }

  return documents;
}

async function parseJsonImportRequest(req: NextRequest): Promise<ImportDocument[]> {
  const body = await req.json();

  if (Array.isArray(body?.documents)) {
    return body.documents as ImportDocument[];
  }

  if (Array.isArray(body?.memories)) {
    return body.memories.map((memory: Record<string, unknown>) => ({
      title: asString(memory.sourceTitle) || "Restored",
      content: asString(memory.content) || "",
      sourceType: asString(memory.source) || "text",
      sourceId: asString(memory.sourceId) || null,
      timestamp: memory.timestamp ? new Date(String(memory.timestamp)) : undefined,
      metadata: isRecord(memory.metadata) ? memory.metadata : {},
      contentType: (asString(memory.contentType) as ImportDocument["contentType"]) || "text",
    }));
  }

  return [];
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
