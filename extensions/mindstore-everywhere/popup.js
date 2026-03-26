/* global chrome */

const baseUrlInput = document.getElementById("baseUrl");
const apiKeyInput = document.getElementById("apiKey");
const captureModeInput = document.getElementById("captureMode");
const captureButton = document.getElementById("captureButton");
const testConnectionButton = document.getElementById("testConnectionButton");
const queryInput = document.getElementById("queryInput");
const queryButton = document.getElementById("queryButton");
const queryResults = document.getElementById("queryResults");
const sourceBadge = document.getElementById("sourceBadge");
const contextSummary = document.getElementById("contextSummary");
const setupBadge = document.getElementById("setupBadge");
const setupSummary = document.getElementById("setupSummary");
const captureEndpoint = document.getElementById("captureEndpoint");
const queryEndpoint = document.getElementById("queryEndpoint");
const docsLink = document.getElementById("docsLink");
const downloadLink = document.getElementById("downloadLink");
const statusEl = document.getElementById("status");

initialize();

async function initialize() {
  const { baseUrl = "http://localhost:3000", apiKey = "", captureMode = "smart" } =
    await chrome.storage.local.get(["baseUrl", "apiKey", "captureMode"]);

  baseUrlInput.value = baseUrl;
  apiKeyInput.value = apiKey;
  captureModeInput.value = captureMode;
  renderSetupLinks(baseUrl);

  await Promise.all([inspectActiveTab(), refreshSetupStatus({ silent: true })]);
}

baseUrlInput.addEventListener("change", persistPreferences);
apiKeyInput.addEventListener("change", persistPreferences);
captureModeInput.addEventListener("change", persistPreferences);
captureButton.addEventListener("click", handleCapture);
testConnectionButton.addEventListener("click", () => {
  void refreshSetupStatus({ interactive: true });
});
queryButton.addEventListener("click", handleQuery);
queryInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    void handleQuery();
  }
});

async function persistPreferences() {
  const baseUrl = baseUrlInput.value.trim();
  await chrome.storage.local.set({
    baseUrl,
    apiKey: apiKeyInput.value.trim(),
    captureMode: captureModeInput.value,
  });
  renderSetupLinks(baseUrl);
  void refreshSetupStatus({ silent: true });
}

async function handleCapture() {
  const baseUrl = normalizeBaseUrl(baseUrlInput.value);
  const apiKey = apiKeyInput.value.trim();
  const captureMode = captureModeInput.value;

  if (!baseUrl) {
    setStatus("Add your MindStore URL first.", "error");
    return;
  }

  captureButton.disabled = true;
  setStatus("Reading this page…");

  try {
    const payload = await getActiveCapturePayload();

    setStatus("Saving to MindStore…");

    const headers = {
      "Content-Type": "application/json",
    };

    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    const response = await fetch(`${baseUrl}/api/v1/capture`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        capture: {
          ...payload,
          captureMode,
          metadata: {
            ...(payload.metadata || {}),
            extensionVersion: chrome.runtime.getManifest().version,
          },
        },
      }),
    });

    if (!response.ok) {
      const error = await safeJson(response);
      throw new Error(error?.error || `Import failed with status ${response.status}`);
    }

    const sourceLabel = payload.sourceApp ? startCase(payload.sourceApp) : "page";
    setStatus(`Saved ${sourceLabel} context to MindStore.`, "success");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Capture failed.", "error");
  } finally {
    captureButton.disabled = false;
  }
}

async function handleQuery() {
  const baseUrl = normalizeBaseUrl(baseUrlInput.value);
  const apiKey = apiKeyInput.value.trim();
  const query = queryInput.value.trim();

  if (!baseUrl) {
    setStatus("Add your MindStore URL first.", "error");
    return;
  }

  if (!query) {
    setStatus("Enter a question or keyword to search your memories.", "error");
    return;
  }

  queryButton.disabled = true;
  renderEmptyState("Searching your MindStore…");

  try {
    const headers = {
      "Content-Type": "application/json",
    };

    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    const response = await fetch(`${baseUrl}/api/v1/capture/query`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        query,
        limit: 5,
      }),
    });

    const payload = await safeJson(response);

    if (!response.ok) {
      throw new Error(payload?.error || `Search failed with status ${response.status}`);
    }

    renderResults(payload?.results || []);
  } catch (error) {
    renderEmptyState(error instanceof Error ? error.message : "Search failed.");
  } finally {
    queryButton.disabled = false;
  }
}

async function inspectActiveTab() {
  try {
    const tab = await getActiveTab();
    const payload = await chrome.tabs.sendMessage(tab.id, { type: "mindstore:inspect" });
    const sourceLabel = payload?.sourceApp ? startCase(payload.sourceApp) : "Web";
    sourceBadge.textContent = sourceLabel;
    contextSummary.textContent =
      payload?.summary || "Save the current page, selection, or supported conversation.";
  } catch {
    sourceBadge.textContent = "Unavailable";
    contextSummary.textContent =
      "This page cannot be inspected automatically, but capture may still work on standard websites.";
  }
}

async function refreshSetupStatus({ interactive = false, silent = false } = {}) {
  const baseUrl = normalizeBaseUrl(baseUrlInput.value);
  const apiKey = apiKeyInput.value.trim();

  if (!baseUrl) {
    renderSetupState("Add URL", "Enter your MindStore URL to test the extension setup.", "");
    return;
  }

  testConnectionButton.disabled = true;

  if (interactive) {
    setStatus("Checking MindStore connection…");
  }

  try {
    const headers = {};
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    const response = await fetch(`${baseUrl}/api/v1/extension/setup`, { headers });
    const payload = await safeJson(response);

    if (!response.ok) {
      throw new Error(payload?.error || `Connection test failed with status ${response.status}`);
    }

    renderSetupLinks(payload?.connection?.baseUrl || baseUrl, payload);
    renderSetupState(
      payload?.auth?.authenticated || !apiKey ? "Connected" : "Auth required",
      payload?.auth?.authenticated || !apiKey
        ? `Ready for capture and query. Extension v${payload?.product?.extensionVersion || chrome.runtime.getManifest().version}.`
        : "The server responded, but the provided API key was not accepted.",
      payload?.auth?.authenticated || !apiKey ? "success" : "error"
    );

    if (interactive) {
      setStatus("MindStore connection verified.", "success");
    } else if (!silent) {
      setStatus("MindStore connection updated.", "success");
    }
  } catch (error) {
    renderSetupLinks(baseUrl);
    renderSetupState(
      "Unavailable",
      "Could not reach the extension setup endpoint. Check your URL, deployment, and API key.",
      "error"
    );

    if (interactive || !silent) {
      setStatus(error instanceof Error ? error.message : "Connection test failed.", "error");
    }
  } finally {
    testConnectionButton.disabled = false;
  }
}

async function getActiveCapturePayload() {
  const tab = await getActiveTab();
  const payload = await chrome.tabs.sendMessage(tab.id, { type: "mindstore:capture" });

  if (!payload) {
    throw new Error("No page content was available to capture.");
  }

  return payload;
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    throw new Error("Could not resolve the active tab.");
  }

  return tab;
}

function setStatus(message, tone = "") {
  statusEl.textContent = message;
  statusEl.className = tone ? `status ${tone}` : "status";
}

function renderSetupState(label, summary, tone) {
  setupBadge.textContent = label;
  setupBadge.className = tone ? `setup-badge ${tone}` : "setup-badge";
  setupSummary.textContent = summary;
}

function renderSetupLinks(baseUrl, payload = null) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl) || "http://localhost:3000";
  const connection = payload?.connection || {
    captureUrl: `${normalizedBaseUrl}/api/v1/capture`,
    queryUrl: `${normalizedBaseUrl}/api/v1/capture/query`,
    docsUrl: `${normalizedBaseUrl}/docs/getting-started/mindstore-everywhere`,
    downloadUrl: `${normalizedBaseUrl}/api/v1/extension/package`,
  };

  captureEndpoint.textContent = connection.captureUrl;
  queryEndpoint.textContent = connection.queryUrl;
  docsLink.href = connection.docsUrl;
  downloadLink.href = connection.downloadUrl;
}

function renderResults(results) {
  if (!Array.isArray(results) || results.length === 0) {
    renderEmptyState("No memories matched yet. Try importing more data or broadening the query.");
    return;
  }

  queryResults.innerHTML = results
    .map(
      (result) => `
        <article class="result-card">
          <h3>${escapeHtml(result.title || "Untitled Memory")}</h3>
          <p class="result-meta">${escapeHtml(startCase(result.sourceType || "memory"))}</p>
          <p class="result-copy">${escapeHtml(result.excerpt || "No preview available.")}</p>
          ${
            result.url
              ? `<a class="result-link" href="${escapeAttribute(result.url)}" target="_blank" rel="noreferrer">Open source</a>`
              : ""
          }
        </article>
      `
    )
    .join("");
}

function renderEmptyState(message) {
  queryResults.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
}

function normalizeBaseUrl(value) {
  return String(value || "").trim().replace(/\/$/, "");
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function startCase(value) {
  return String(value || "")
    .split(/[-_\s]+/g)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
