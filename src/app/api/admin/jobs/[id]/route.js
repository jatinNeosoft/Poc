import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { jsonError, parseBody, requireAdmin, validate } from "@/lib/api"
import { generatedQuestionsSchema, jobInputSchema, jobStatusSchema } from "@/lib/validators/job"
import { isSelectableModel } from "@/lib/ai/catalog"

async function findJob(id) {
  return prisma.job.findUnique({ where: { id } })
}

export async function GET(_req, { params }) {
  const { response } = await requireAdmin()
  if (response) return response

  const { id } = await params
  const job = await findJob(id)
  if (!job) return jsonError("Job not found", 404)
  return NextResponse.json({ job })
}

// Full edit (form fields) — the slug is never changed so printed QR codes keep working
export async function PUT(req, { params }) {
  const { response } = await requireAdmin()
  if (response) return response

  const { id } = await params
  const existing = await findJob(id)
  if (!existing) return jsonError("Job not found", 404)

  const { data, response: invalid } = await parseBody(req, jobInputSchema)
  if (invalid) return invalid
  // A deactivated model may stay on a job that already uses it, but cannot be newly chosen
  const unchanged = data.aiProvider === existing.aiProvider && data.aiModel === existing.aiModel
  if (data.aiProvider && !unchanged && !(await isSelectableModel(data.aiProvider, data.aiModel))) {
    return jsonError("Validation failed", 400, { fieldErrors: { aiModel: ["This model is not active in Settings → Model pricing"] } })
  }

  const job = await prisma.job.update({ where: { id }, data })
  return NextResponse.json({ job })
}

// Small updates: { status } to close/reopen, or { generatedQuestions } after admin edits
export async function PATCH(req, { params }) {
  const { response } = await requireAdmin()
  if (response) return response

  const { id } = await params
  if (!(await findJob(id))) return jsonError("Job not found", 404)

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== "object") return jsonError("Invalid JSON body")

  const schema = "status" in body ? jobStatusSchema : generatedQuestionsSchema
  const { data, response: invalid } = validate(body, schema)
  if (invalid) return invalid

  const job = await prisma.job.update({ where: { id }, data })
  return NextResponse.json({ job })
}
