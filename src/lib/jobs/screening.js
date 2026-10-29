import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { loadPrompt } from "@/lib/prompts"
import { generateStructured } from "@/lib/ai"
import { resolveAI } from "@/lib/ai/models"
import { getAISettings } from "@/lib/settings"
import { formatSalary, JOB_TYPE_LABELS } from "@/lib/jobs/format"

// No min/max on the array: strict structured-output schemas don't allow them, so we trim after
const ScreeningSchema = z.object({
  questions: z.array(z.string()).describe("2 to 4 short screening questions"),
})

/** Ask the job's AI model for 2–4 screening questions, save them on the job, log the cost. */
export async function generateScreeningQuestions(job) {
  const { provider, model } = resolveAI(job, await getAISettings())

  const system = await loadPrompt("en", "screening-gen", {
    title: job.title,
    location: job.location,
    jobType: JOB_TYPE_LABELS[job.jobType],
    salary: formatSalary(job.salaryMin, job.salaryMax),
    experienceRequired: job.experienceRequired,
    requiredSkills: job.requiredSkills.join(", "),
    description: job.description,
    customQuestions: job.customQuestions.length ? job.customQuestions.map((q) => `- ${q}`).join("\n") : "(none)",
  })

  const { data } = await generateStructured({
    provider,
    model,
    purpose: "SCREENING_GEN",
    jobId: job.id,
    system,
    messages: [{ role: "user", content: "Write the screening questions for this job." }],
    schema: ScreeningSchema,
    schemaName: "screening_questions",
    maxTokens: 4000,
  })

  const custom = new Set(job.customQuestions.map((q) => q.trim().toLowerCase()))
  const questions = [...new Set(data.questions.map((q) => q.trim()).filter(Boolean))]
    .filter((q) => !custom.has(q.toLowerCase()))
    .slice(0, 4)

  return prisma.job.update({
    where: { id: job.id },
    data: { generatedQuestions: questions },
  })
}
