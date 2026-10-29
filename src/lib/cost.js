import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"

export function usdToInrRate() {
  const rate = Number(process.env.USD_TO_INR)
  return Number.isFinite(rate) && rate > 0 ? rate : 84
}

/** Cost from token counts and per-million-token prices (plain numbers). */
export function computeCost({ inputTokens, outputTokens, inputPerMillionUsd, outputPerMillionUsd, rate }) {
  const costUsd = (inputTokens * inputPerMillionUsd + outputTokens * outputPerMillionUsd) / 1_000_000
  return { costUsd, costInr: costUsd * rate }
}

/** Save one AIUsage row with cost calculated from ModelPricing. Missing price → cost 0 + warning. */
export async function recordUsage({ provider, model, purpose, jobId, interviewId, inputTokens, outputTokens }) {
  const pricing = await prisma.modelPricing.findUnique({
    where: { provider_model: { provider, model } },
  })
  if (!pricing) console.warn(`[cost] No ModelPricing row for ${provider}/${model}; cost recorded as 0`)

  const rate = usdToInrRate()
  const { costUsd, costInr } = computeCost({
    inputTokens,
    outputTokens,
    inputPerMillionUsd: Number(pricing?.inputPerMillionUsd ?? 0),
    outputPerMillionUsd: Number(pricing?.outputPerMillionUsd ?? 0),
    rate,
  })

  return prisma.aIUsage.create({
    data: {
      provider,
      model,
      purpose,
      jobId: jobId ?? null,
      interviewId: interviewId ?? null,
      inputTokens,
      outputTokens,
      costUsd: new Prisma.Decimal(costUsd.toFixed(6)),
      costInr: new Prisma.Decimal(costInr.toFixed(4)),
      usdToInr: new Prisma.Decimal(rate),
    },
  })
}
