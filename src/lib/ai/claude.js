import Anthropic from "@anthropic-ai/sdk"
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod"
import { AIConfigError, AIResponseError } from "./errors"

// Models that support the server-side refusal fallback ("default" routing)
const FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-sonnet-5-5"])

let client

function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) throw new AIConfigError("ANTHROPIC_API_KEY is not set")
  client ??= new Anthropic()
  return client
}

/**
 * One structured-output call. `schema` is a Zod object; returns the parsed object + token usage.
 * Forced tool_choice is not supported on current models, so structured outputs are used instead.
 */
export async function generateStructured({ model, system, messages, schema, maxTokens = 8000, effort = "low" }) {
  const params = {
    model,
    max_tokens: maxTokens,
    system,
    messages,
    output_config: { format: zodOutputFormat(schema), effort },
  }

  const res = FALLBACK_MODELS.has(model)
    ? await getClient().beta.messages.parse({
        ...params,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      })
    : await getClient().messages.parse(params)

  if (res.stop_reason === "refusal") throw new AIResponseError("The model declined this request")
  if (res.stop_reason === "max_tokens") throw new AIResponseError("The model response was cut off (max_tokens)")
  if (!res.parsed_output) throw new AIResponseError("The model response did not match the expected format")

  return {
    data: res.parsed_output,
    usage: {
      inputTokens:
        (res.usage.input_tokens ?? 0) +
        (res.usage.cache_creation_input_tokens ?? 0) +
        (res.usage.cache_read_input_tokens ?? 0),
      outputTokens: res.usage.output_tokens ?? 0,
    },
    servedBy: res.model,
  }
}
