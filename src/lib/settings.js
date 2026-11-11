import { prisma } from "@/lib/prisma"
import { envDefaultModel, envDefaultProvider } from "@/lib/ai/models"
import { ALL_TTS_VOICES } from "@/lib/tts/server"

export const TTS_MODES = ["auto", "browser", "server"]

async function readSetting(key) {
  const row = await prisma.appSetting.findUnique({ where: { key } })
  return row?.value ?? {}
}

/** Merge `value` into the stored setting (unset keys keep their previous value). */
export async function writeSetting(key, value) {
  const current = await readSetting(key)
  const merged = { ...current, ...value }
  await prisma.appSetting.upsert({ where: { key }, create: { key, value: merged }, update: { value: merged } })
  return merged
}

/** Default AI provider/models: Settings page → .env → built-in default. */
export async function getAISettings() {
  const s = await readSetting("ai")
  return {
    provider: s.provider ?? envDefaultProvider(),
    claudeModel: s.claudeModel ?? envDefaultModel("CLAUDE"),
    openaiModel: s.openaiModel ?? envDefaultModel("OPENAI"),
  }
}

/** Read-aloud: mode (auto | browser | server) and Google server voice per language code. */
export async function getTtsSettings() {
  const s = await readSetting("tts")
  const envMode = process.env.TTS_MODE?.trim().toLowerCase()
  return {
    mode: s.mode ?? (TTS_MODES.includes(envMode) ? envMode : "server"),
    // Drop voices saved for an older provider (e.g. OpenAI "nova"): the language file default is used instead
    voices: Object.fromEntries(Object.entries(s.voices ?? {}).filter(([, v]) => ALL_TTS_VOICES.includes(v))),
  }
}

export async function getUsdToInr() {
  const s = await readSetting("currency")
  const rate = Number(s.usdToInr ?? process.env.USD_TO_INR)
  return Number.isFinite(rate) && rate > 0 ? rate : 84
}
