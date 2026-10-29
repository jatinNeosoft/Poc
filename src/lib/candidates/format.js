// Display helpers shared by the candidate list, detail page and PDF

export const CANDIDATE_STATUS = {
  NEW: { label: "New", className: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300" },
  SHORTLISTED: { label: "Shortlisted", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" },
  REJECTED: { label: "Rejected", className: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300" },
}

export const LANGUAGE_NAMES = { hi: "Hindi", en: "English" }

export function formatExperience(years) {
  if (years === null || years === undefined) return "—"
  if (years === 0) return "Fresher"
  if (years < 1) return `${Math.round(years * 12)} months`
  return `${years} ${years === 1 ? "year" : "years"}`
}

export function formatDuration(start, end) {
  if (!start || !end) return null
  const sec = Math.round((new Date(end) - new Date(start)) / 1000)
  const m = Math.floor(sec / 60)
  return m ? `${m} min ${sec % 60} s` : `${sec} s`
}

export const dateTimeFmt = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
})

export const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })

/** Value of a CV field as display text ("—" when empty). */
export function formatCvValue(key, value) {
  if (value === null || value === undefined || (Array.isArray(value) && !value.length)) return "—"
  if (key === "totalExperienceYears") return formatExperience(value)
  if (key === "age") return `${value} years`
  if (typeof value === "boolean") return value ? "Yes" : "No"
  if (key === "previousJobs") {
    return value.map((j) => [j.role, j.company, j.duration].filter(Boolean).join(" · ")).join("\n")
  }
  if (Array.isArray(value)) return value.join(", ")
  return String(value)
}

export function fitTone(score) {
  if (score === null || score === undefined) return "muted"
  if (score >= 8) return "good"
  if (score >= 5) return "mid"
  return "low"
}
