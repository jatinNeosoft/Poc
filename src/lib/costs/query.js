import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"

export const INTERVIEWS_PAGE_SIZE = 25
export const COST_TABS = ["interviews", "job", "day", "month", "model", "purpose"]

const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v ?? "")

/** Filters from URL search params; dates are calendar days in India time. */
export function parseCostFilters(sp) {
  return {
    from: isDate(sp.from) ? sp.from : "",
    to: isDate(sp.to) ? sp.to : "",
    provider: sp.provider === "CLAUDE" || sp.provider === "OPENAI" ? sp.provider : "",
    job: typeof sp.job === "string" ? sp.job : "",
    tab: COST_TABS.includes(sp.tab) ? sp.tab : "interviews",
    page: Math.max(1, Number.parseInt(sp.page, 10) || 1),
  }
}

// createdAt is stored as UTC in a timestamp without time zone → convert to IST for day/month buckets
const IST_TIME = Prisma.sql`((u."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata')`

function usageWhere(f) {
  const c = [Prisma.sql`TRUE`]
  if (f.from) c.push(Prisma.sql`u."createdAt" >= ${new Date(`${f.from}T00:00:00+05:30`)}`)
  if (f.to) c.push(Prisma.sql`u."createdAt" <= ${new Date(`${f.to}T23:59:59.999+05:30`)}`)
  if (f.provider) c.push(Prisma.sql`u.provider = ${f.provider}::"AIProvider"`)
  if (f.job) c.push(Prisma.sql`u."jobId" = ${f.job}`)
  return Prisma.join(c, " AND ")
}

// Raw SQL returns BigInt for counts/integer sums and Decimal for money → plain numbers
const num = (v) => (v === null || v === undefined ? 0 : Number(v))
const SUMS = Prisma.sql`
  COALESCE(SUM(u."inputTokens"), 0) AS "inputTokens",
  COALESCE(SUM(u."outputTokens"), 0) AS "outputTokens",
  COALESCE(SUM(u."cacheReadTokens"), 0) AS "cacheReadTokens",
  COALESCE(SUM(u."costUsd"), 0) AS "costUsd",
  COALESCE(SUM(u."costInr"), 0) AS "costInr",
  COUNT(*) AS calls`
function sums(r) {
  return {
    inputTokens: num(r.inputTokens),
    outputTokens: num(r.outputTokens),
    cacheReadTokens: num(r.cacheReadTokens),
    costUsd: num(r.costUsd),
    costInr: num(r.costInr),
    calls: num(r.calls),
  }
}

export async function getCostTotals(f) {
  const where = usageWhere(f)
  const [[t], [avg]] = await Promise.all([
    prisma.$queryRaw`SELECT ${SUMS}, COUNT(DISTINCT u."interviewId") AS interviews FROM "AIUsage" u WHERE ${where}`,
    // Average over completed interviews only (unfinished ones would pull it down)
    prisma.$queryRaw`
      SELECT COALESCE(AVG(per.inr), 0) AS "avgInr", COALESCE(AVG(per.usd), 0) AS "avgUsd", COUNT(*) AS n
      FROM (
        SELECT SUM(u."costInr") AS inr, SUM(u."costUsd") AS usd
        FROM "AIUsage" u JOIN "Interview" i ON i.id = u."interviewId"
        WHERE ${where} AND i.status = 'COMPLETED'
        GROUP BY u."interviewId"
      ) per`,
  ])
  return {
    ...sums(t),
    interviews: num(t.interviews),
    avgCompletedInr: num(avg.avgInr),
    avgCompletedUsd: num(avg.avgUsd),
    completed: num(avg.n),
  }
}

/** Cost per IST day for the chart; missing days filled with 0. Defaults to the last 30 days. */
export async function getDailySeries(f) {
  const todayIst = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10)
  const to = f.to || todayIst
  const from = f.from || new Date(new Date(`${to}T00:00:00Z`).getTime() - 29 * 86_400_000).toISOString().slice(0, 10)

  const rows = await prisma.$queryRaw`
    SELECT to_char(date_trunc('day', ${IST_TIME}), 'YYYY-MM-DD') AS day, ${SUMS}
    FROM "AIUsage" u WHERE ${usageWhere({ ...f, from, to })}
    GROUP BY 1 ORDER BY 1`
  const byDay = new Map(rows.map((r) => [r.day, sums(r)]))

  const days = []
  for (let d = new Date(`${from}T00:00:00Z`); d <= new Date(`${to}T00:00:00Z`); d = new Date(d.getTime() + 86_400_000)) {
    const key = d.toISOString().slice(0, 10)
    days.push({ day: key, ...(byDay.get(key) ?? sums({})) })
  }
  return { from, to, days: days.slice(-92) } // chart readability cap: ~3 months of bars
}

export async function getCostByJob(f) {
  const rows = await prisma.$queryRaw`
    SELECT j.id, j.title, j.location, COUNT(DISTINCT u."interviewId") AS interviews, ${SUMS}
    FROM "AIUsage" u JOIN "Job" j ON j.id = u."jobId"
    WHERE ${usageWhere(f)}
    GROUP BY j.id ORDER BY "costInr" DESC`
  return rows.map((r) => ({ id: r.id, title: r.title, location: r.location, interviews: num(r.interviews), ...sums(r) }))
}

export async function getCostByPeriod(f, unit) {
  const fmt = unit === "month" ? "YYYY-MM" : "YYYY-MM-DD"
  const trunc = unit === "month" ? Prisma.sql`'month'` : Prisma.sql`'day'`
  const rows = await prisma.$queryRaw`
    SELECT to_char(date_trunc(${trunc}, ${IST_TIME}), ${fmt}) AS period,
           COUNT(DISTINCT u."interviewId") AS interviews, ${SUMS}
    FROM "AIUsage" u WHERE ${usageWhere(f)}
    GROUP BY 1 ORDER BY 1 DESC`
  return rows.map((r) => ({ period: r.period, interviews: num(r.interviews), ...sums(r) }))
}

export async function getCostByModel(f) {
  const rows = await prisma.$queryRaw`
    SELECT u.provider::text AS provider, u.model, COUNT(DISTINCT u."interviewId") AS interviews, ${SUMS}
    FROM "AIUsage" u WHERE ${usageWhere(f)}
    GROUP BY u.provider, u.model ORDER BY "costInr" DESC`
  return rows.map((r) => ({ provider: r.provider, model: r.model, interviews: num(r.interviews), ...sums(r) }))
}

export async function getCostByPurpose(f) {
  const rows = await prisma.$queryRaw`
    SELECT u.purpose::text AS purpose, ${SUMS}
    FROM "AIUsage" u WHERE ${usageWhere(f)}
    GROUP BY u.purpose ORDER BY "costInr" DESC`
  return rows.map((r) => ({ purpose: r.purpose, ...sums(r) }))
}

/** One row per interview: its AI usage within the filters, plus message count and duration. */
export async function getCostPerInterview(f) {
  const where = usageWhere(f)
  const [rows, [{ total }]] = await Promise.all([
    prisma.$queryRaw`
      SELECT i.id, i."startedAt", i."endedAt", i.status::text AS status, i.provider::text AS provider, i.model,
             c.id AS "candidateId", c."fullName", j.title AS "jobTitle", ${SUMS},
             (SELECT COUNT(*) FROM "Message" m WHERE m."interviewId" = i.id AND m.role <> 'SYSTEM') AS messages
      FROM "AIUsage" u
      JOIN "Interview" i ON i.id = u."interviewId"
      JOIN "Candidate" c ON c.id = i."candidateId"
      JOIN "Job" j ON j.id = i."jobId"
      WHERE ${where}
      GROUP BY i.id, c.id, j.id
      ORDER BY i."startedAt" DESC
      LIMIT ${INTERVIEWS_PAGE_SIZE} OFFSET ${(f.page - 1) * INTERVIEWS_PAGE_SIZE}`,
    prisma.$queryRaw`SELECT COUNT(DISTINCT u."interviewId") AS total FROM "AIUsage" u WHERE ${where} AND u."interviewId" IS NOT NULL`,
  ])
  return {
    total: num(total),
    pages: Math.max(1, Math.ceil(num(total) / INTERVIEWS_PAGE_SIZE)),
    rows: rows.map((r) => ({
      id: r.id,
      candidateId: r.candidateId,
      name: r.fullName,
      jobTitle: r.jobTitle,
      status: r.status,
      provider: r.provider,
      model: r.model,
      startedAt: r.startedAt,
      endedAt: r.endedAt,
      messages: num(r.messages),
      ...sums(r),
    })),
  }
}
