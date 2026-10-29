import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { getUsdToInr } from "@/lib/settings"

// Prompt-cache price multipliers on the normal input price.
// Claude: cache write (5 min) 1.25x, cache read 0.1x. OpenAI: cached input ~0.1x, no write charge.
const CACHE_MULTIPLIERS = {
  CLAUDE: { read: 0.1, write: 1.25 },
  OPENAI: { read: 0.1, write: 1 },
}

/** Cost from token counts and per-million-token prices. `inputTokens` includes cached tokens. */
export function computeCost({
  provider,
  inputTokens,
  outputTokens,
  cacheReadTokens = 0,
  cacheWriteTokens = 0,
  inputPerMillionUsd,
  outputPerMillionUsd,
  rate,
}) {
  const m = CACHE_MULTIPLIERS[provider] ?? { read: 1, write: 1 }
  const plainInput = Math.max(0, inputTokens - cacheReadTokens - cacheWriteTokens)
  const weightedInput = plainInput + cacheReadTokens * m.read + cacheWriteTokens * m.write
  const costUsd = (weightedInput * inputPerMillionUsd + outputTokens * outputPerMillionUsd) / 1_000_000
  return { costUsd, costInr: costUsd * rate }
}

/** Save one AIUsage row with cost calculated from ModelPricing. Missing price → cost 0 + warning. */
export async function recordUsage({
  provider,
  model,
  purpose,
  jobId,
  interviewId,
  inputTokens,
  outputTokens,
  cacheReadTokens = 0,
  cacheWriteTokens = 0,
}) {
  const pricing = await prisma.modelPricing.findUnique({
    where: { provider_model: { provider, model } },
  })
  if (!pricing) console.warn(`[cost] No ModelPricing row for ${provider}/${model}; cost recorded as 0`)

  const rate = await getUsdToInr()
  const { costUsd, costInr } = computeCost({
    provider,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheWriteTokens,
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
      cacheReadTokens,
      cacheWriteTokens,
      costUsd: new Prisma.Decimal(costUsd.toFixed(6)),
      costInr: new Prisma.Decimal(costInr.toFixed(4)),
      usdToInr: new Prisma.Decimal(rate),
    },
  })
}
