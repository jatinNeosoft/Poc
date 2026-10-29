// Hard checks in code, on top of the AI's own answer check.
// Each returns { ok: true, value } with a cleaned value, or { ok: false }.

const ok = (value) => ({ ok: true, value })
const fail = { ok: false }

export function normalizePhone(raw) {
  let digits = String(raw ?? "").replace(/\D/g, "")
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2)
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1)
  return /^[6-9]\d{9}$/.test(digits) ? digits : null // Indian mobile numbers start with 6–9
}

function cleanText(v, max = 200) {
  const s = typeof v === "string" ? v.trim().replace(/\s+/g, " ") : ""
  return s ? s.slice(0, max) : null
}

function cleanList(v, maxItems = 30) {
  if (!Array.isArray(v)) return null
  const seen = new Set()
  const out = []
  for (const item of v) {
    const s = cleanText(item, 100)
    if (s && !seen.has(s.toLowerCase())) {
      seen.add(s.toLowerCase())
      out.push(s)
    }
  }
  return out.length ? out.slice(0, maxItems) : null
}

const RULES = {
  phone: (v) => {
    const phone = normalizePhone(v)
    return phone ? ok(phone) : fail
  },
  age: (v) => (Number.isInteger(v) && v >= 18 && v <= 65 ? ok(v) : fail),
  totalExperienceYears: (v) =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 60 ? ok(Math.round(v * 10) / 10) : fail,
  willingToRelocate: (v) => (typeof v === "boolean" ? ok(v) : fail),
  previousJobs: (v) => {
    if (!Array.isArray(v)) return fail
    const jobs = v
      .map((j) => ({
        company: cleanText(j?.company, 100),
        role: cleanText(j?.role, 100),
        duration: cleanText(j?.duration, 60),
      }))
      .filter((j) => j.company || j.role)
      .slice(0, 10)
    return jobs.length ? ok(jobs) : fail
  },
  skills: (v) => (cleanList(v) ? ok(cleanList(v)) : fail),
  languagesKnown: (v) => (cleanList(v, 10) ? ok(cleanList(v, 10)) : fail),
  certifications: (v) => (cleanList(v, 15) ? ok(cleanList(v, 15)) : fail),
}

/** Validate + clean one CV value from the model. Text fields just get trimmed. */
export function checkCvValue(key, value) {
  if (value === null || value === undefined) return fail
  const rule = RULES[key]
  if (rule) return rule(value)
  const text = cleanText(value)
  return text ? ok(text) : fail
}

// Fields with a canned re-ask message (languages/<code>.json → labels.reask)
export const REASK_FIELDS = new Set(["phone", "age"])
