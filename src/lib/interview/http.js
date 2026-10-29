import { NextResponse } from "next/server"
import { InterviewError, findInterviewForToken } from "./engine"
import { AIConfigError, AIResponseError } from "@/lib/ai"
import { clientIp, rateLimit } from "@/lib/rate-limit"

// Error codes the candidate page knows how to show (translated in languages/*.json)
export function interviewError(code, status, retryAfterSec) {
  const headers = retryAfterSec ? { "Retry-After": String(retryAfterSec) } : undefined
  return NextResponse.json({ error: code }, { status, headers })
}

const INTERVIEW_ERROR_STATUS = { not_found: 404, job_closed: 410, bad_language: 400, finished: 409, bad_state: 409 }

/** Map engine / AI errors to a JSON response. */
export function handleInterviewError(err) {
  if (err instanceof InterviewError) return interviewError(err.code, INTERVIEW_ERROR_STATUS[err.code] ?? 400)
  console.error("[interview]", err)
  if (err instanceof AIConfigError || err instanceof AIResponseError) return interviewError("ai_unavailable", 503)
  return interviewError("ai_unavailable", 503) // provider outage, timeout, rate limit from the AI API…
}

/** Resume-token check from the x-resume-token header → { interview } or { response }. */
export async function authorizeInterview(req, id) {
  const interview = await findInterviewForToken(id, req.headers.get("x-resume-token"))
  if (!interview) return { response: interviewError("not_found", 404) }
  return { interview }
}

/** Apply several [key, [limit, windowMs]] limits; first one that trips wins. */
export function checkLimits(req, entries) {
  for (const [key, [limit, windowMs]] of entries) {
    const r = rateLimit(key, limit, windowMs)
    if (!r.ok) return interviewError("too_many_requests", 429, r.retryAfterSec)
  }
  return null
}

export const ipKey = (req, name) => `${name}:ip:${clientIp(req)}`

// One AI turn at a time per interview (double taps, two tabs)
const busy = new Set()
export async function withInterviewLock(id, fn) {
  if (busy.has(id)) return interviewError("busy", 409)
  busy.add(id)
  try {
    return await fn()
  } finally {
    busy.delete(id)
  }
}
