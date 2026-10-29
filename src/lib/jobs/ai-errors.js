import { AIConfigError, AIResponseError } from "@/lib/ai"

/** Short admin-facing message for a failed AI call (full error goes to the server log). */
export function describeAIError(err) {
  console.error("[ai]", err)
  if (err instanceof AIConfigError) return `AI questions not generated: ${err.message}.`
  if (err instanceof AIResponseError) return `AI questions not generated: ${err.message}.`
  return "AI questions not generated: the AI service returned an error. Try “Regenerate” later."
}
