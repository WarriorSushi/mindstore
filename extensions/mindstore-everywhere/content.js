/* global chrome */

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "mindstore:inspect") {
    sendResponse(inspectPage());
    return true;
  }

  if (message?.type === "mindstore:capture") {
    sendResponse(buildCapturePayload());
    return true;
  }

  return false;
});

function inspectPage() {
  const adapter = detectAdapter();
  const selection = getSelectionText();
  const conversationText = extractConversationText(adapter);
  const hasConversation = Boolean(conversationText);
  const availableModes = ["smart", "page"];

  if (selection) {
    availableModes.push("selection");
  }

  if (hasConversation) {
    availableModes.push("conversation");
  }

  return {
    title: document.title,
    url: window.location.href,
    sourceApp: adapter?.id || "web",
    availableModes,
    summary: hasConversation
      ? `Detected ${adapter?.label || "conversation"} context on this page.`
      : selection
        ? "Selection capture is available on this page."
        : "Using page excerpt capture for this page.",
  };
}

function buildCapturePayload() {
  const adapter = detectAdapter();
  const selection = getSelectionText();
  const pageText = extractPageText();
  const conversationText = extractConversationText(adapter);

  return {
    title: document.title,
    url: window.location.href,
    sourceApp: adapter?.id || "web",
    selection,
    pageText,
    conversationText,
    metadata: {
      hostname: window.location.hostname,
      hasConversation: Boolean(conversationText),
      hasSelection: Boolean(selection),
    },
  };
}

function getSelectionText() {
  return window.getSelection()?.toString().trim() || "";
}

function extractPageText() {
  const primaryRoot = document.querySelector("main, article, [role='main']") || document.body;
  const bodyText = primaryRoot?.innerText || document.body?.innerText || "";
  return bodyText.replace(/\s+/g, " ").trim().slice(0, 14000);
}

function detectAdapter() {
  const hostname = window.location.hostname.toLowerCase();

  if (hostname.includes("chatgpt.com") || hostname.includes("chat.openai.com")) {
    return {
      id: "chatgpt",
      label: "ChatGPT",
      extractConversation() {
        return extractRoleBasedConversation("[data-message-author-role]", (element) =>
          element.getAttribute("data-message-author-role")
        );
      },
    };
  }

  if (hostname.includes("claude.ai")) {
    return {
      id: "claude",
      label: "Claude",
      extractConversation() {
        return (
          extractRoleBasedConversation("[data-testid*='message']", inferRoleFromElement) ||
          extractRoleBasedConversation("[data-message-author-role]", (element) =>
            element.getAttribute("data-message-author-role")
          )
        );
      },
    };
  }

  if (hostname.includes("openclaw")) {
    return {
      id: "openclaw",
      label: "OpenClaw",
      extractConversation() {
        return (
          extractRoleBasedConversation("[data-role]", (element) => element.getAttribute("data-role")) ||
          extractRoleBasedConversation("[data-message-author-role]", (element) =>
            element.getAttribute("data-message-author-role")
          )
        );
      },
    };
  }

  return null;
}

function extractConversationText(adapter) {
  if (!adapter?.extractConversation) {
    return "";
  }

  return adapter.extractConversation() || "";
}

function extractRoleBasedConversation(selector, getRole) {
  const nodes = Array.from(document.querySelectorAll(selector));
  if (!nodes.length) {
    return "";
  }

  const messages = [];
  const seen = new Set();

  for (const node of nodes) {
    const text = node.innerText?.replace(/\s+/g, " ").trim();
    if (!text || text.length < 8 || seen.has(text)) {
      continue;
    }

    seen.add(text);
    const role = normalizeRole(getRole(node) || inferRoleFromElement(node));
    messages.push(`${role}: ${text}`);
  }

  return messages.join("\n\n").slice(0, 18000);
}

function inferRoleFromElement(element) {
  const attrText = [
    element.getAttribute("data-testid"),
    element.getAttribute("aria-label"),
    element.className,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (attrText.includes("assistant")) {
    return "assistant";
  }

  if (attrText.includes("user") || attrText.includes("human")) {
    return "user";
  }

  return "message";
}

function normalizeRole(role) {
  const normalized = String(role || "").toLowerCase();

  if (normalized.includes("assistant")) {
    return "assistant";
  }

  if (normalized.includes("user") || normalized.includes("human")) {
    return "user";
  }

  return "message";
}
