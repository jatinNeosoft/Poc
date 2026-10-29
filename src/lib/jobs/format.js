// Display helpers shared by server and client components

export const JOB_TYPE_LABELS = {
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
  CONTRACT: "Contract",
}

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })

export function formatSalary(min, max) {
  if (min && max) return min === max ? `${inr.format(min)}/month` : `${inr.format(min)} – ${inr.format(max)}/month`
  if (min) return `From ${inr.format(min)}/month`
  if (max) return `Up to ${inr.format(max)}/month`
  return "Not specified"
}

export function publicJobUrl(slug) {
  const base = (process.env.APP_BASE_URL || "http://localhost:3000").replace(/\/+$/, "")
  return `${base}/apply/${slug}`
}
