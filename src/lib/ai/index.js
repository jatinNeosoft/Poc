import * as claude from "./claude"
import * as openai from "./openai"
import { recordUsage } from "@/lib/cost"

const PROVIDERS = { CLAUDE: claude, OPENAI: openai }

export { AIConfigError, AIResponseError } from "./errors"

/**
 * Provider-agnostic structured call that also logs token usage + cost.
 * @param {object} opts
 * @param {"CLAUDE"|"OPENAI"} opts.provider
 * @param {string} opts.model
 * @param {string} opts.system
 * @param {{role: "user"|"assistant", content: string}[]} opts.messages
 * @param {import("zod").ZodObject} opts.schema
 * @param {string} opts.purpose AIPurpose enum value
 * @param {string} [opts.jobId]
 * @param {string} [opts.interviewId]
 */
export async function generateStructured({ provider, purpose, jobId, interviewId, ...callOpts }) {
  const impl = PROVIDERS[provider]
  if (!impl) throw new Error(`Unknown AI provider: ${provider}`)

  const result = await impl.generateStructured(callOpts)

  await recordUsage({
    provider,
    model: callOpts.model,
    purpose,
    jobId,
    interviewId,
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
  })

  return result
}
