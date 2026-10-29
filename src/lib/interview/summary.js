import { prisma } from "@/lib/prisma"
import { generateStructured } from "@/lib/ai"
import { loadPrompt } from "@/lib/prompts"
import { CV_FIELDS } from "./fields"
import { jobBlock } from "./prompt"
import { SummarySchema } from "./schema"

function cvBlock(candidate) {
  return CV_FIELDS.map((f) => {
    const v = candidate[f.key]
    const text =
      v === null || v === undefined || (Array.isArray(v) && !v.length)
        ? "(not given)"
        : Array.isArray(v)
          ? v.map((x) => (typeof x === "object" ? [x.role, x.company, x.duration].filter(Boolean).join(", ") : x)).join("; ")
          : typeof v === "boolean"
            ? v ? "yes" : "no"
            : String(v)
    return `- ${f.label}: ${text}`
  }).join("\n")
}

/** AI summary + fit score (1–10) for a completed interview. Runs after the response is sent. */
export async function generateSummary(interviewId) {
  const interview = await prisma.interview.findUnique({
    where: { id: interviewId },
    include: {
      job: true,
      candidate: { include: { screeningAnswers: { orderBy: { order: "asc" } } } },
      answerChecks: { orderBy: { createdAt: "asc" } },
    },
  })
  if (!interview || interview.status !== "COMPLETED") return

  const { job, candidate } = interview
  const screening = candidate.screeningAnswers.length
    ? candidate.screeningAnswers
        .map((a) => `- Q: ${a.question}\n  A: ${a.answer}${a.flagged ? " (FLAGGED: unclear)" : ""}`)
        .join("\n")
    : "(none)"

  // Last check per question is the one that counted
  const lastChecks = new Map(interview.answerChecks.map((c) => [c.target, c]))
  const checks =
    [...lastChecks.values()]
      .filter((c) => c.flagged || c.fit === "NEGATIVE" || c.fit === "POSITIVE")
      .map((c) => `- ${c.target}: quality ${c.quality}, fit ${c.fit}${c.fitReason ? ` (${c.fitReason})` : ""}${c.flagged ? ", FLAGGED" : ""}`)
      .join("\n") || "(nothing notable)"

  const system = await loadPrompt("en", "summary", {
    jobBlock: jobBlock(job),
    cvBlock: cvBlock(candidate),
    screeningBlock: screening,
    checksBlock: checks,
  })

  const { data } = await generateStructured({
    provider: interview.provider,
    model: interview.model,
    purpose: "SUMMARY",
    interviewId,
    jobId: job.id,
    system,
    messages: [{ role: "user", content: "Write the summary and fit score for this candidate." }],
    schema: SummarySchema,
    schemaName: "candidate_summary",
    maxTokens: 4000,
    effort: "medium",
  })

  await prisma.candidate.update({
    where: { id: candidate.id },
    data: {
      aiSummary: data.summary.trim(),
      fitScore: Math.min(10, Math.max(1, Math.round(data.fitScore))),
      fitReason: data.fitReason.trim(),
    },
  })
}
