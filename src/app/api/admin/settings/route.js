import { NextResponse } from "next/server"
import { z } from "zod"
import { jsonError, parseBody, requireAdmin } from "@/lib/api"
import { isSelectableModel } from "@/lib/ai/catalog"
import { getLanguages } from "@/lib/languages"
import { TTS_MODES, writeSetting } from "@/lib/settings"
import { ALL_TTS_VOICES } from "@/lib/tts/server"

const bodySchema = z.discriminatedUnion("section", [
  z.object({
    section: z.literal("ai"),
    provider: z.enum(["CLAUDE", "OPENAI"]),
    claudeModel: z.string().min(1).max(100),
    openaiModel: z.string().min(1).max(100),
  }),
  z.object({
    section: z.literal("tts"),
    mode: z.enum(TTS_MODES),
    voices: z.record(z.string(), z.enum(ALL_TTS_VOICES)),
  }),
  z.object({
    section: z.literal("currency"),
    usdToInr: z.number().min(1, "Too low").max(1000, "Too high"),
  }),
])

// Save one settings section (AI defaults, read-aloud voice, currency)
export async function PUT(req) {
  const { response } = await requireAdmin()
  if (response) return response

  const { data, response: invalid } = await parseBody(req, bodySchema)
  if (invalid) return invalid
  const { section, ...value } = data

  if (section === "ai") {
    const fieldErrors = {}
    if (!(await isSelectableModel("CLAUDE", value.claudeModel))) fieldErrors.claudeModel = ["Not an active Claude model"]
    if (!(await isSelectableModel("OPENAI", value.openaiModel))) fieldErrors.openaiModel = ["Not an active OpenAI model"]
    if (Object.keys(fieldErrors).length) return jsonError("Validation failed", 400, { fieldErrors })
  }

  if (section === "tts") {
    const codes = new Set(getLanguages().map((l) => l.code))
    value.voices = Object.fromEntries(Object.entries(value.voices).filter(([code]) => codes.has(code)))
  }

  const saved = await writeSetting(section, value)
  return NextResponse.json({ section, value: saved })
}
