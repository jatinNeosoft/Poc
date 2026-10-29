import { createHash } from "node:crypto"
import OpenAI from "openai"
import { getStorage } from "@/lib/storage"
import { recordUsage } from "@/lib/cost"
import { AIConfigError } from "@/lib/ai"

// tts-1 is billed per character, so cost is exact: ModelPricing row "tts-1" holds $ per 1M characters
const TTS_MODEL = "tts-1"
let client

function getClient() {
  if (!process.env.OPENAI_API_KEY) throw new AIConfigError("OPENAI_API_KEY is not set (needed for server voice)")
  client ??= new OpenAI()
  return client
}

/** MP3 for the text, cached on disk by voice + text so repeats cost nothing. */
export async function synthesizeSpeech({ text, voice, interviewId, jobId }) {
  const storage = getStorage()
  const hash = createHash("sha256").update(`${TTS_MODEL}|${voice}|${text}`).digest("hex").slice(0, 32)
  const key = `tts/${hash}.mp3`

  if (await storage.stat(key)) return { key, cached: true }

  const res = await getClient().audio.speech.create({ model: TTS_MODEL, voice, input: text, response_format: "mp3" })
  await storage.save(key, Buffer.from(await res.arrayBuffer()), "audio/mpeg")

  await recordUsage({
    provider: "OPENAI",
    model: TTS_MODEL,
    purpose: "TTS",
    interviewId,
    jobId,
    inputTokens: [...text].length, // characters, matching the per-character price
    outputTokens: 0,
  })
  return { key, cached: false }
}
