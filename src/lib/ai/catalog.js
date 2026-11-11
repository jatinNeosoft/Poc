import { prisma } from "@/lib/prisma"
import { AI_MODELS, PROVIDER_LABELS, isTtsModel, modelLabel } from "./models"

// Text-to-speech models have pricing rows too, but are not chat models
const isChatModel = (provider, model) => provider in PROVIDER_LABELS && !isTtsModel(model)

/**
 * Chat models the admin can pick: every ACTIVE pricing row, so adding a pricing row in
 * Settings makes a new model selectable without code changes.
 * `include` keeps a job's current model in the list even if it was deactivated later.
 */
export async function getModelOptions(include) {
  const rows = await prisma.modelPricing.findMany({ where: { active: true } })
  const options = { CLAUDE: [], OPENAI: [] }
  for (const r of rows) {
    if (isChatModel(r.provider, r.model)) options[r.provider].push({ id: r.model, label: modelLabel(r.provider, r.model) })
  }
  if (include?.provider && include?.model && !options[include.provider].some((m) => m.id === include.model)) {
    options[include.provider].push({ id: include.model, label: `${modelLabel(include.provider, include.model)} (inactive)` })
  }

  // Known models in our preferred order (cheapest first), unknown ones after, by name
  for (const provider of Object.keys(options)) {
    const order = AI_MODELS[provider].map((m) => m.id)
    const rank = (id) => (order.includes(id) ? order.indexOf(id) : order.length)
    options[provider].sort((a, b) => rank(a.id) - rank(b.id) || a.id.localeCompare(b.id))
  }
  return options
}

export async function isSelectableModel(provider, model) {
  if (!provider || !model || !isChatModel(provider, model)) return false
  const row = await prisma.modelPricing.findUnique({ where: { provider_model: { provider, model } } })
  return !!row?.active
}
