import { NextResponse, after } from "next/server"
import { prisma } from "@/lib/prisma"
import { getStorage } from "@/lib/storage"
import { getClientState, videoEvent } from "@/lib/interview/engine"
import { generateSummary } from "@/lib/interview/summary"
import { authorizeInterview, checkLimits, handleInterviewError, interviewError, withInterviewLock } from "@/lib/interview/http"
import { LIMITS } from "@/lib/rate-limit"

const MAX_BYTES = 60 * 1024 * 1024 // ~60 s at the recorder's 1 Mbps is ~8 MB; leave room for phones that ignore it
const EXT = { "video/webm": "webm", "video/mp4": "mp4" }

// Upload the intro video, then continue the interview (same as a "video uploaded" event)
export async function POST(req, { params }) {
  const { id } = await params
  const { interview, response } = await authorizeInterview(req, id)
  if (response) return response

  const limited = checkLimits(req, [[`video:interview:${id}`, LIMITS.videoPerInterview]])
  if (limited) return limited

  if (interview.status !== "IN_PROGRESS" || interview.step !== "VIDEO" || interview.videoChoice !== "YES") {
    return interviewError("bad_state", 409)
  }

  const form = await req.formData().catch(() => null)
  const file = form?.get("video")
  if (!file || typeof file === "string") return interviewError("bad_request", 400)

  const baseType = file.type.split(";")[0]
  if (!EXT[baseType]) return interviewError("bad_video_type", 415)
  if (file.size === 0 || file.size > MAX_BYTES) return interviewError("bad_video_size", 413)

  const durationSec = Math.round(Math.min(Math.max(Number(form.get("durationSec")) || 0, 0), 120)) || null

  return withInterviewLock(id, async () => {
    try {
      const storage = getStorage()
      const key = `videos/${interview.candidateId}-${Date.now()}.${EXT[baseType]}`
      const saved = await storage.save(key, Buffer.from(await file.arrayBuffer()), baseType)

      const previous = await prisma.video.findUnique({ where: { candidateId: interview.candidateId } })
      await prisma.video.upsert({
        where: { candidateId: interview.candidateId },
        create: {
          candidateId: interview.candidateId,
          storageKey: saved.key,
          url: saved.url,
          mimeType: baseType,
          durationSec,
          sizeBytes: file.size,
        },
        update: { storageKey: saved.key, url: saved.url, mimeType: baseType, durationSec, sizeBytes: file.size },
      })
      if (previous) await storage.remove(previous.storageKey).catch(() => {})

      const result = await videoEvent(id, "uploaded")
      if (result.completed) after(() => generateSummary(id).catch((e) => console.error("[summary]", e)))

      return NextResponse.json({ state: await getClientState(id) })
    } catch (err) {
      return handleInterviewError(err)
    }
  })
}
