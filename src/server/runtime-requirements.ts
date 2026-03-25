export type ProviderAuthModeStatus = "available" | "planned" | "risky";

export interface ProviderAuthMode {
  id: string;
  label: string;
  status: ProviderAuthModeStatus;
  description: string;
}

export interface ProviderCatalogEntry {
  id: string;
  name: string;
  tagline: string;
  supports: {
    chat: boolean;
    embeddings: boolean;
  };
  authModes: ProviderAuthMode[];
}

export interface RuntimeRequirementItem {
  id: string;
  label: string;
  value: string;
  required: boolean;
  description: string;
}

export const RUNTIME_REQUIREMENTS: RuntimeRequirementItem[] = [
  {
    id: "database",
    label: "Database",
    value: "PostgreSQL 16+ with pgvector and pg_trgm",
    required: true,
    description:
      "This is the only hard infrastructure requirement. It can be self-hosted or provided by Supabase, Neon, Railway, Render, or any Postgres host that supports the needed extensions.",
  },
  {
    id: "hosting",
    label: "Hosting",
    value: "Any Node-capable host",
    required: false,
    description:
      "Vercel is convenient, but not required. A VPS, Docker deployment, or another Node host works too.",
  },
  {
    id: "sign-in",
    label: "User auth",
    value: "Optional Google OAuth today",
    required: false,
    description:
      "Single-user self-hosted mode works without login. Google OAuth matters more for shared or hosted deployments.",
  },
  {
    id: "ai-provider",
    label: "AI provider access",
    value: "Optional for imports, required for semantic AI features",
    required: false,
    description:
      "MindStore can import, browse, and use keyword-style search without a paid AI provider. Semantic embeddings, RAG chat, and some analysis flows need either an API-backed provider or a local model runtime.",
  },
];

export const PROVIDER_CATALOG: ProviderCatalogEntry[] = [
  {
    id: "gemini",
    name: "Google Gemini",
    tagline: "Best default for low-cost hosted semantic features",
    supports: {
      chat: true,
      embeddings: true,
    },
    authModes: [
      {
        id: "api-key",
        label: "API key",
        status: "available",
        description: "Works today through the Settings page and environment variables.",
      },
      {
        id: "subscription-login",
        label: "Subscription / account login",
        status: "planned",
        description:
          "Planned as a future auth-profile flow if Google exposes a durable, supported path that fits self-hosted MindStore.",
      },
    ],
  },
  {
    id: "openai",
    name: "OpenAI",
    tagline: "Strong hosted default when API-based OpenAI access is preferred",
    supports: {
      chat: true,
      embeddings: true,
    },
    authModes: [
      {
        id: "api-key",
        label: "API key",
        status: "available",
        description: "Works today through the Settings page and environment variables.",
      },
      {
        id: "codex-oauth",
        label: "Subscription auth (Codex / ChatGPT OAuth style)",
        status: "planned",
        description:
          "Planned as an auth-profile flow modeled after tools like OpenClaw, where supported provider OAuth can be used instead of direct API billing.",
      },
    ],
  },
  {
    id: "ollama",
    name: "Ollama",
    tagline: "Best local/private option with no external API billing",
    supports: {
      chat: true,
      embeddings: true,
    },
    authModes: [
      {
        id: "local-runtime",
        label: "Local runtime",
        status: "available",
        description: "Works today by pointing MindStore at a running Ollama instance.",
      },
    ],
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    tagline: "One key for many model providers",
    supports: {
      chat: true,
      embeddings: false,
    },
    authModes: [
      {
        id: "api-key",
        label: "API key",
        status: "available",
        description: "Works today for chat through the Settings page.",
      },
    ],
  },
  {
    id: "custom",
    name: "Custom OpenAI-compatible",
    tagline: "Bring your own gateway, proxy, or model API",
    supports: {
      chat: true,
      embeddings: false,
    },
    authModes: [
      {
        id: "api-key",
        label: "API key",
        status: "available",
        description: "Works today for OpenAI-compatible chat endpoints.",
      },
      {
        id: "oauth-or-bridge",
        label: "OAuth / bridge profile",
        status: "planned",
        description:
          "Planned for future auth-profile adapters such as provider device-login flows or trusted local bridges.",
      },
    ],
  },
];

export const PROVIDER_AUTH_ROADMAP = [
  {
    id: "phase-1",
    label: "Phase 1",
    description:
      "Keep API keys and Ollama first-class, because they are predictable, self-hostable, and easy to support today.",
  },
  {
    id: "phase-2",
    label: "Phase 2",
    description:
      "Add encrypted auth profiles for providers that officially support OAuth or device-login style subscription auth, starting with the safest supported targets.",
  },
  {
    id: "phase-3",
    label: "Phase 3",
    description:
      "Allow provider plugins and bridge adapters to register their own auth flows without hardcoding everything into core MindStore.",
  },
];
