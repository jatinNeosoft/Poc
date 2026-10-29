import { NextResponse } from "next/server"
import { z } from "zod"
import { getClientState, startInterview } from "@/lib/interview/engine"
import { checkLimits, handleInterviewError, interviewError, ipKey } from "@/lib/interview/http"
import { LIMITS } from "@/lib/rate-limit"

const bodySchema = z.object({ slug: z.string().min(1).max(100), language: z.string().min(2).max(10) })

export async function POST(req) {
  const limited = checkLimits(req, [[ipKey(req, "start"), LIMITS.startPerIp]])
  if (limited) return limited

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return interviewError("bad_request", 400)

  try {
    const { interviewId, resumeToken } = await startInterview({
      slug: parsed.data.slug,
      languageCode: parsed.data.language,
    })
    return NextResponse.json({ resumeToken, state: await getClientState(interviewId) }, { status: 201 })
  } catch (err) {
    return handleInterviewError(err)
  }
}
