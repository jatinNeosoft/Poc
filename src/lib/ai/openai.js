import OpenAI from "openai"
import { zodTextFormat } from "openai/helpers/zod"
import { AIConfigError, AIResponseError } from "./errors"

let client

function getClient() {
  if (!process.env.OPENAI_API_KEY) throw new AIConfigError("OPENAI_API_KEY is not set")
  client ??= new OpenAI()
  return client
}

/**
 * One structured-output call via the Responses API. Same contract as the Claude provider.
 * Note: OpenAI strict schemas need every field required — use .nullable() instead of .optional().
 * OpenAI caches long stable prefixes automatically; `turnContext` goes last (developer message) to keep the prefix stable.
 */
export async function generateStructured({
  model,
  system,
  messages,
  turnContext = null,
  schema,
  schemaName = "result",
  maxTokens = 8000,
}) {
  const input = messages.map((m) => ({ role: m.role, content: m.content }))
  if (turnContext) input.push({ role: "developer", content: turnContext })

  const res = await getClient().responses.parse({
    model,
    instructions: system,
    input,
    text: { format: zodTextFormat(schema, schemaName) },
    max_output_tokens: maxTokens,
  })

  if (res.status === "incomplete") {
    throw new AIResponseError(`The model response was incomplete (${res.incomplete_details?.reason ?? "unknown"})`)
  }
  if (!res.output_parsed) throw new AIResponseError("The model response did not match the expected format")

  return {
    data: res.output_parsed,
    usage: {
      inputTokens: res.usage?.input_tokens ?? 0,
      cacheReadTokens: res.usage?.input_tokens_details?.cached_tokens ?? 0,
      cacheWriteTokens: 0,
      outputTokens: res.usage?.output_tokens ?? 0,
    },
    servedBy: res.model,
  }
}
