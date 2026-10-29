// Models the admin can pick per job. Prices live in the ModelPricing table (seeded, editable).
export const AI_MODELS = {
  CLAUDE: [
    { id: "claude-opus-5-5", label: "Claude Opus 5.5 (best quality)" },
    { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5 (balanced)" },
    { id: "claude-haiku-5-5", label: "Claude Haiku 5.5 (lowest cost)" },
  ],
  OPENAI: [
    { id: "gpt-6.1-sol", label: "GPT-6.1 Sol (balanced)" },
    { id: "gpt-6.1-terra", label: "GPT-6.1 Terra (lower cost)" },
    { id: "gpt-6-luna", label: "GPT-6 Luna (lowest cost)" },
    { id: "gpt-6-astra", label: "GPT-6 Astra (flagship)" },
  ],
}

export const PROVIDER_LABELS = { CLAUDE: "Claude (Anthropic)", OPENAI: "OpenAI" }

// AI_PROVIDER env uses lowercase names: claude | openai
export function defaultProvider() {
  return process.env.AI_PROVIDER?.trim().toLowerCase() === "openai" ? "OPENAI" : "CLAUDE"
}

export function defaultModel(provider) {
  if (provider === "OPENAI") return process.env.OPENAI_MODEL?.trim() || "gpt-6.1-sol"
  return process.env.CLAUDE_MODEL?.trim() || "claude-opus-5-5"
}

export function isKnownModel(provider, model) {
  return !!AI_MODELS[provider]?.some((m) => m.id === model)
}

// Job setting wins; otherwise fall back to env defaults
export function resolveAI(job) {
  const provider = job?.aiProvider || defaultProvider()
  const model = job?.aiProvider && job?.aiModel ? job.aiModel : defaultModel(provider)
  return { provider, model }
}
