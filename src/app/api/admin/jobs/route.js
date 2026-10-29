import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { jsonError, parseBody, requireAdmin } from "@/lib/api"
import { jobInputSchema } from "@/lib/validators/job"
import { makeJobSlug } from "@/lib/slug"
import { generateScreeningQuestions } from "@/lib/jobs/screening"
import { describeAIError } from "@/lib/jobs/ai-errors"
import { isSelectableModel } from "@/lib/ai/catalog"

export async function GET(req) {
  const { response } = await requireAdmin()
  if (response) return response

  const status = req.nextUrl.searchParams.get("status")
  const jobs = await prisma.job.findMany({
    where: status === "OPEN" || status === "CLOSED" ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { candidates: true } } },
  })
  return NextResponse.json({ jobs })
}

export async function POST(req) {
  const { response } = await requireAdmin()
  if (response) return response

  const { data, response: invalid } = await parseBody(req, jobInputSchema)
  if (invalid) return invalid
  if (data.aiProvider && !(await isSelectableModel(data.aiProvider, data.aiModel))) {
    return jsonError("Validation failed", 400, { fieldErrors: { aiModel: ["This model is not active in Settings → Model pricing"] } })
  }

  // Retry on the (very unlikely) slug collision
  let job
  for (let attempt = 0; attempt < 3 && !job; attempt++) {
    try {
      job = await prisma.job.create({ data: { ...data, slug: makeJobSlug(data.title) } })
    } catch (err) {
      const slugTaken = err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002"
      if (!slugTaken) throw err
    }
  }
  if (!job) return jsonError("Could not create a unique link, please try again", 500)

  // The job is saved even if AI question generation fails; the admin can regenerate later
  let warning = null
  try {
    job = await generateScreeningQuestions(job)
  } catch (err) {
    warning = describeAIError(err)
  }

  return NextResponse.json({ job, warning }, { status: 201 })
}
