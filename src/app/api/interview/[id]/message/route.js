import { NextResponse, after } from "next/server"
import { z } from "zod"
import { getClientState, runTurn, videoEvent } from "@/lib/interview/engine"
import { generateSummary } from "@/lib/interview/summary"
import {
  authorizeInterview,
  checkLimits,
  handleInterviewError,
  interviewError,
  ipKey,
  withInterviewLock,
} from "@/lib/interview/http"
import { LIMITS } from "@/lib/rate-limit"

const bodySchema = z.union([
  z.object({
    text: z.string().trim().min(1).max(1000),
    inputMode: z.enum(["voice", "text"]),
    sttConfidence: z.number().min(0).max(1).nullable().optional(),
  }),
  z.object({ event: z.literal("video_skipped") }),
])

export async function POST(req, { params }) {
  const { id } = await params
  const { response } = await authorizeInterview(req, id)
  if (response) return response

  const limited = checkLimits(req, [
    [`message:interview:${id}`, LIMITS.messagePerInterview],
    [ipKey(req, "message"), LIMITS.messagePerIp],
  ])
  if (limited) return limited

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return interviewError("bad_request", 400)
  const body = parsed.data

  return withInterviewLock(id, async () => {
    try {
      const result =
        "event" in body
          ? await videoEvent(id, "skipped")
          : await runTurn(id, { kind: "answer", ...body, sttConfidence: body.sttConfidence ?? null })

      // Summary + fit score after the response is sent, so the candidate is not kept waiting
      if (result.completed) after(() => generateSummary(id).catch((e) => console.error("[summary]", e)))

      return NextResponse.json({ state: await getClientState(id) })
    } catch (err) {
      return handleInterviewError(err)
    }
  })
}
