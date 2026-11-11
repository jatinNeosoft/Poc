// Client-safe model helpers (no DB). Which models are selectable comes from active
// ModelPricing rows (see ./catalog.js); this list only provides friendly labels + order.
export const AI_MODELS = {
  CLAUDE: [
    { id: "claude-haiku-5-5", label: "Claude Haiku 5.5 (lowest cost)" },
    { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5 (balanced)" },
    { id: "claude-opus-5-5", label: "Claude Opus 5.5 (best quality)" },
  ],
  OPENAI: [
    { id: "gpt-6-luna", label: "GPT-6 Luna (lowest cost)" },
    { id: "gpt-6.1-terra", label: "GPT-6.1 Terra (lower cost)" },
    { id: "gpt-6.1-sol", label: "GPT-6.1 Sol (balanced)" },
    { id: "gpt-6-astra", label: "GPT-6 Astra (flagship)" },
  ],
}

export const PROVIDER_LABELS = { CLAUDE: "Claude (Anthropic)", OPENAI: "OpenAI" }

// Everything that can appear in costs/pricing: the chat providers + Google (server voice only)
export const COST_PROVIDER_LABELS = { ...PROVIDER_LABELS, GOOGLE: "Google Cloud" }

// Pricing rows whose model starts with "tts" are voices billed per character, not chat models
export const isTtsModel = (model) => model.startsWith("tts")

export function modelLabel(provider, model) {
  return AI_MODELS[provider]?.find((m) => m.id === model)?.label ?? model
}

// .env fallbacks — AI_PROVIDER uses lowercase names: claude | openai
export function envDefaultProvider() {
  return process.env.AI_PROVIDER?.trim().toLowerCase() === "openai" ? "OPENAI" : "CLAUDE"
}

export function envDefaultModel(provider) {
  if (provider === "OPENAI") return process.env.OPENAI_MODEL?.trim() || "gpt-6.1-sol"
  return process.env.CLAUDE_MODEL?.trim() || "claude-haiku-5-5"
}

/**
 * Provider + model for a job: the job's own choice wins, else the defaults
 * (from Settings, see getAISettings()).
 */
export function resolveAI(job, defaults) {
  if (job?.aiProvider && job?.aiModel) return { provider: job.aiProvider, model: job.aiModel }
  const provider = defaults.provider
  return { provider, model: provider === "OPENAI" ? defaults.openaiModel : defaults.claudeModel }
}
