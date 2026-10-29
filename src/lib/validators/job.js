import { z } from "zod"

const optionalInt = z
  .number({ error: "Enter a number" })
  .int("Use whole rupees")
  .min(0, "Cannot be negative")
  .max(10_000_000, "Too large")
  .nullable()

const cleanList = (max, itemMax) =>
  z
    .array(z.string().trim().max(itemMax, `Max ${itemMax} characters`))
    .max(max, `Max ${max} items`)
    .transform((list) => [...new Set(list.filter(Boolean))])

// Shared by the job form (client) and the API (server)
export const jobInputSchema = z
  .object({
    title: z.string().trim().min(3, "At least 3 characters").max(120),
    description: z.string().trim().min(20, "Describe the job in at least 20 characters").max(5000),
    location: z.string().trim().min(2, "Location is required").max(120),
    salaryMin: optionalInt,
    salaryMax: optionalInt,
    jobType: z.enum(["FULL_TIME", "PART_TIME", "CONTRACT"]),
    openings: z.number({ error: "Enter a number" }).int().min(1, "At least 1").max(10_000),
    requiredSkills: cleanList(30, 60),
    experienceRequired: z.string().trim().max(120).nullable(),
    customQuestions: cleanList(10, 300),
    aiProvider: z.enum(["CLAUDE", "OPENAI"]).nullable(),
    aiModel: z.string().nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.salaryMin != null && v.salaryMax != null && v.salaryMax < v.salaryMin) {
      ctx.addIssue({ code: "custom", path: ["salaryMax"], message: "Max salary must be ≥ min salary" })
    }
    // Whether the model is active is checked on the server (pricing table)
    if (v.aiProvider && !v.aiModel) {
      ctx.addIssue({ code: "custom", path: ["aiModel"], message: "Pick a model for this provider" })
    }
  })
  .transform((v) => ({
    ...v,
    experienceRequired: v.experienceRequired || null,
    aiModel: v.aiProvider ? v.aiModel : null, // "Default" provider → no model stored
  }))

export const jobStatusSchema = z.object({ status: z.enum(["OPEN", "CLOSED"]) })

export const generatedQuestionsSchema = z.object({
  generatedQuestions: cleanList(6, 300),
})

