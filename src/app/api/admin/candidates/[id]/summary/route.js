import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { jsonError, requireAdmin } from "@/lib/api"
import { generateSummary } from "@/lib/interview/summary"
import { describeAIError } from "@/lib/jobs/ai-errors"

// (Re)generate the AI summary + fit score, e.g. if the background run after the interview failed
export async function POST(_req, { params }) {
  const { response } = await requireAdmin()
  if (response) return response

  const { id } = await params
  const candidate = await prisma.candidate.findUnique({ where: { id }, include: { interview: true } })
  if (!candidate?.interview) return jsonError("Candidate not found", 404)
  if (candidate.interview.status !== "COMPLETED") return jsonError("The interview is not finished yet", 409)

  try {
    await generateSummary(candidate.interview.id)
  } catch (err) {
    return jsonError(describeAIError(err, "Summary not generated"), 502)
  }
  const updated = await prisma.candidate.findUnique({
    where: { id },
    select: { aiSummary: true, fitScore: true, fitReason: true },
  })
  return NextResponse.json({ candidate: updated })
}
