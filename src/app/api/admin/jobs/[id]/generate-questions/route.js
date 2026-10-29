import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { jsonError, requireAdmin } from "@/lib/api"
import { generateScreeningQuestions } from "@/lib/jobs/screening"
import { describeAIError } from "@/lib/jobs/ai-errors"

export async function POST(_req, { params }) {
  const { response } = await requireAdmin()
  if (response) return response

  const { id } = await params
  const job = await prisma.job.findUnique({ where: { id } })
  if (!job) return jsonError("Job not found", 404)

  try {
    const updated = await generateScreeningQuestions(job)
    return NextResponse.json({ job: updated })
  } catch (err) {
    return jsonError(describeAIError(err), 502)
  }
}
