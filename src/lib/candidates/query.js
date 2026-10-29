import { prisma } from "@/lib/prisma"

export const PAGE_SIZE = 20
const STATUSES = new Set(["NEW", "SHORTLISTED", "REJECTED"])

/** Read list filters from URL search params (all optional, invalid values ignored). */
export function parseCandidateFilters(sp) {
  const date = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v ?? "") ? v : "")
  return {
    q: (sp.q ?? "").trim().slice(0, 100),
    job: sp.job ?? "",
    status: STATUSES.has(sp.status) ? sp.status : "",
    lang: /^[a-z]{2,3}$/.test(sp.lang ?? "") ? sp.lang : "",
    from: date(sp.from),
    to: date(sp.to),
    flagged: sp.flagged === "1",
    page: Math.max(1, Number.parseInt(sp.page, 10) || 1),
  }
}

/** Prisma where-clause. Abandoned (restarted elsewhere) and duplicate interviews are not applications. */
export function candidateWhere(f) {
  const interview = { status: { in: ["IN_PROGRESS", "COMPLETED"] } }
  if (f.lang) interview.language = f.lang
  if (f.from || f.to) {
    interview.startedAt = {
      ...(f.from ? { gte: new Date(`${f.from}T00:00:00+05:30`) } : {}),
      ...(f.to ? { lte: new Date(`${f.to}T23:59:59.999+05:30`) } : {}),
    }
  }

  const where = { interview: { is: interview } }
  if (f.job) where.jobId = f.job
  if (f.status) where.status = f.status
  if (f.flagged) where.flaggedCount = { gt: 0 }
  if (f.q) {
    const digits = f.q.replace(/\D/g, "")
    where.OR = [
      { fullName: { contains: f.q, mode: "insensitive" } },
      ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : []),
    ]
  }
  return where
}

export async function listCandidates(f) {
  const where = candidateWhere(f)
  const [total, rows] = await Promise.all([
    prisma.candidate.count({ where }),
    prisma.candidate.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (f.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        job: { select: { id: true, title: true } },
        interview: { select: { language: true, startedAt: true, status: true } },
        video: { select: { id: true } },
      },
    }),
  ])
  return { total, rows, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) }
}
