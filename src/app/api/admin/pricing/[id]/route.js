import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { jsonError, parseBody, requireAdmin } from "@/lib/api"
import { pricingUpdateSchema } from "@/lib/validators/pricing"
import { getAISettings } from "@/lib/settings"

// Change prices (applies to future AI calls only) or activate / deactivate a model
export async function PATCH(req, { params }) {
  const { response } = await requireAdmin()
  if (response) return response

  const { id } = await params
  const row = await prisma.modelPricing.findUnique({ where: { id } })
  if (!row) return jsonError("Price not found", 404)

  const { data, response: invalid } = await parseBody(req, pricingUpdateSchema)
  if (invalid) return invalid

  if (data.active === false) {
    const defaults = await getAISettings()
    const isDefault =
      (row.provider === "CLAUDE" && defaults.claudeModel === row.model) ||
      (row.provider === "OPENAI" && defaults.openaiModel === row.model)
    if (isDefault) {
      return jsonError(`${row.model} is a default model. Choose another default in "AI defaults" first.`, 409)
    }
  }

  const pricing = await prisma.modelPricing.update({ where: { id }, data })
  return NextResponse.json({ pricing })
}
