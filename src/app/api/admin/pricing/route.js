import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { jsonError, parseBody, requireAdmin } from "@/lib/api"
import { pricingCreateSchema } from "@/lib/validators/pricing"

export async function GET() {
  const { response } = await requireAdmin()
  if (response) return response
  const pricing = await prisma.modelPricing.findMany({ orderBy: [{ provider: "asc" }, { model: "asc" }] })
  return NextResponse.json({ pricing })
}

// Add a model price. Once active, the model can be chosen for jobs.
export async function POST(req) {
  const { response } = await requireAdmin()
  if (response) return response

  const { data, response: invalid } = await parseBody(req, pricingCreateSchema)
  if (invalid) return invalid

  try {
    const row = await prisma.modelPricing.create({ data })
    return NextResponse.json({ pricing: row }, { status: 201 })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return jsonError("Validation failed", 409, { fieldErrors: { model: ["This model already has a price — edit it instead"] } })
    }
    throw err
  }
}
