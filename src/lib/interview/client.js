// Browser-side helpers for the candidate interview (no server imports here)

const storageKey = (slug) => `hv:interview:${slug}`

/** Saved { interviewId, resumeToken } for this job on this device, or null. */
export function loadSession(slug) {
  try {
    const raw = localStorage.getItem(storageKey(slug))
    const s = raw ? JSON.parse(raw) : null
    return s?.interviewId && s?.resumeToken ? s : null
  } catch {
    return null
  }
}

export function saveSession(slug, session) {
  try {
    localStorage.setItem(storageKey(slug), JSON.stringify(session))
  } catch {
    // Private mode / storage blocked: the interview still works, it just can't resume
  }
}

export function clearSession(slug) {
  try {
    localStorage.removeItem(storageKey(slug))
  } catch {}
}

export class ApiError extends Error {
  constructor(code, status) {
    super(code)
    this.code = code
    this.status = status
  }
}

/** JSON request; throws ApiError(code) with the server's error code, or "network". */
export async function api(path, { token, body, formData, method = body || formData ? "POST" : "GET" } = {}) {
  let res
  try {
    res = await fetch(path, {
      method,
      headers: {
        ...(token ? { "x-resume-token": token } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: formData ?? (body ? JSON.stringify(body) : undefined),
    })
  } catch {
    throw new ApiError("network", 0)
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(data.error || "network", res.status)
  return data
}

/** Error code → label key in languages/<code>.json */
export function errorLabel(code) {
  if (code === "too_many_requests" || code === "busy") return "tooFast"
  if (code === "job_closed") return "jobClosed"
  return "networkError"
}
