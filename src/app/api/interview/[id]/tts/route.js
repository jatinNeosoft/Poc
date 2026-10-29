import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { getStorage } from "@/lib/storage"
import { getLanguage } from "@/lib/languages"
import { synthesizeSpeech } from "@/lib/tts/server"
import { authorizeInterview, checkLimits, handleInterviewError, interviewError } from "@/lib/interview/http"
import { LIMITS } from "@/lib/rate-limit"

const bodySchema = z.object({ messageId: z.string().min(1).max(40) })

// Server voice fallback for phones without a matching voice. Only speaks this interview's own AI messages.
export async function POST(req, { params }) {
  const { id } = await params
  const { interview, response } = await authorizeInterview(req, id)
  if (response) return response

  if (process.env.TTS_MODE === "browser") return interviewError("tts_disabled", 404)

  const limited = checkLimits(req, [[`tts:interview:${id}`, LIMITS.ttsPerInterview]])
  if (limited) return limited

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return interviewError("bad_request", 400)

  const message = await prisma.message.findFirst({
    where: { id: parsed.data.messageId, interviewId: id, role: "ASSISTANT" },
  })
  if (!message) return interviewError("not_found", 404)

  try {
    const voice = getLanguage(interview.language)?.tts.serverVoice ?? "nova"
    const { key } = await synthesizeSpeech({
      text: message.content.slice(0, 1000),
      voice,
      interviewId: id,
      jobId: interview.jobId,
    })
    const storage = getStorage()
    const info = await storage.stat(key)
    return new Response(storage.read(key), {
      headers: { "Content-Type": "audio/mpeg", "Content-Length": String(info.size), "Cache-Control": "private, max-age=86400" },
    })
  } catch (err) {
    return handleInterviewError(err)
  }
}
