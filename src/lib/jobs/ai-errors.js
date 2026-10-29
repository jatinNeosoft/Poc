import { AIConfigError, AIResponseError } from "@/lib/ai"

/** Short admin-facing message for a failed AI call (full error goes to the server log). */
export function describeAIError(err, what = "AI questions not generated") {
  console.error("[ai]", err)
  if (err instanceof AIConfigError || err instanceof AIResponseError) return `${what}: ${err.message}.`
  return `${what}: the AI service returned an error. Try again later.`
}
