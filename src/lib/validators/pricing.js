import { z } from "zod"

// USD per 1M tokens (or per 1M characters for tts-* models)
const price = z.number({ error: "Enter a number" }).min(0, "Cannot be negative").max(1000, "Too large")

export const pricingCreateSchema = z.object({
  provider: z.enum(["CLAUDE", "OPENAI"]),
  model: z
    .string()
    .trim()
    .regex(/^[a-z0-9][a-z0-9._:-]{1,79}$/i, "Use the exact model id, e.g. claude-haiku-5-5"),
  inputPerMillionUsd: price,
  outputPerMillionUsd: price,
})

export const pricingUpdateSchema = z
  .object({
    inputPerMillionUsd: price.optional(),
    outputPerMillionUsd: price.optional(),
    active: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Nothing to update")
