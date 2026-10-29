// In-memory sliding-window rate limiter (POC: resets on restart, single instance only).
const hits = new Map()

/** @returns {{ ok: true } | { ok: false, retryAfterSec: number }} */
export function rateLimit(key, limit, windowMs) {
  const now = Date.now()
  const recent = (hits.get(key) ?? []).filter((t) => t > now - windowMs)

  if (recent.length >= limit) {
    hits.set(key, recent)
    return { ok: false, retryAfterSec: Math.ceil((recent[0] + windowMs - now) / 1000) }
  }
  recent.push(now)
  hits.set(key, recent)

  if (hits.size > 10_000) {
    for (const [k, times] of hits) if (!times.some((t) => t > now - windowMs)) hits.delete(k)
  }
  return { ok: true }
}

export function clientIp(req) {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local"
}

// Shared mobile networks put many people behind one IP, so per-IP limits are generous
export const LIMITS = {
  startPerIp: [30, 10 * 60_000],
  messagePerInterview: [Number(process.env.RATE_LIMIT_PER_MIN) || 20, 60_000],
  messagePerIp: [120, 60_000],
  ttsPerInterview: [40, 60_000],
  videoPerInterview: [5, 60 * 60_000],
}
