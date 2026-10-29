import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { jsonError, parseBody, requireAdmin } from "@/lib/api"

const statusSchema = z.object({ status: z.enum(["NEW", "SHORTLISTED", "REJECTED"]) })

// Change the recruiter status of a candidate
export async function PATCH(req, { params }) {
  const { response } = await requireAdmin()
  if (response) return response

  const { id } = await params
  const { data, response: invalid } = await parseBody(req, statusSchema)
  if (invalid) return invalid

  const exists = await prisma.candidate.findUnique({ where: { id }, select: { id: true } })
  if (!exists) return jsonError("Candidate not found", 404)

  const candidate = await prisma.candidate.update({ where: { id }, data, select: { id: true, status: true } })
  return NextResponse.json({ candidate })
}
