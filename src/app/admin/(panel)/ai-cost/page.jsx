import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CostFilters } from "@/components/admin/cost-filters"
import { DailyCostChart } from "@/components/admin/daily-cost-chart"
import { COST_PROVIDER_LABELS, modelLabel } from "@/lib/ai/models"
import { formatDuration } from "@/lib/candidates/format"
import {
  getCostByJob,
  getCostByModel,
  getCostByPeriod,
  getCostByPurpose,
  getCostPerInterview,
  getCostTotals,
  getDailySeries,
  parseCostFilters,
} from "@/lib/costs/query"

export const dynamic = "force-dynamic"
export const metadata = { title: "AI Cost — HireVoice" }

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 })
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 4, maximumFractionDigits: 4 })
// Tokens in K / M (not lakh), the usual convention for token counts
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 })
const dateTime = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })
const dayFmt = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
const monthFmt = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" })

const PURPOSE_LABELS = {
  INTERVIEW_TURN: "Interview chat",
  SUMMARY: "Summary & fit score",
  TTS: "Server voice (read-aloud)",
  TRANSLATION: "Question translation",
  SCREENING_GEN: "Screening question generation",
}

function Stat({ label, value, hint }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl font-semibold tabular-nums">{value}</CardTitle>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardHeader>
    </Card>
  )
}

// Shared token + money columns for every breakdown table
const MONEY_HEADS = ["Input tokens", "Output tokens", "Cost (USD)", "Cost (INR)"]
function MoneyCells({ r }) {
  return (
    <>
      <TableCell className="text-right tabular-nums" title={`${r.inputTokens.toLocaleString("en-IN")} (${r.cacheReadTokens.toLocaleString("en-IN")} from cache)`}>
        {compact.format(r.inputTokens)}
      </TableCell>
      <TableCell className="text-right tabular-nums">{compact.format(r.outputTokens)}</TableCell>
      <TableCell className="text-right tabular-nums">{usd.format(r.costUsd)}</TableCell>
      <TableCell className="pr-4 text-right font-medium tabular-nums">{inr.format(r.costInr)}</TableCell>
    </>
  )
}

function BreakdownTable({ heads, rows, render, totals, empty = "No AI usage for these filters." }) {
  if (!rows.length) return <p className="py-8 text-center text-sm text-muted-foreground">{empty}</p>
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {heads.map((h, i) => (
            <TableHead key={h} className={cn(i === 0 && "pl-4", i >= heads.length - MONEY_HEADS.length && "text-right", i === heads.length - 1 && "pr-4")}>
              {h}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>{rows.map(render)}</TableBody>
      {totals && (
        <TableFooter>
          <TableRow>
            <TableCell className="pl-4 font-medium" colSpan={heads.length - MONEY_HEADS.length}>
              Total
            </TableCell>
            <MoneyCells r={totals} />
          </TableRow>
        </TableFooter>
      )}
    </Table>
  )
}

export default async function AiCostPage({ searchParams }) {
  const sp = await searchParams
  const f = parseCostFilters(sp)

  const [totals, series, perInterview, byJob, byDay, byMonth, byModel, byPurpose, jobs] = await Promise.all([
    getCostTotals(f),
    getDailySeries(f),
    getCostPerInterview(f),
    getCostByJob(f),
    getCostByPeriod(f, "day"),
    getCostByPeriod(f, "month"),
    getCostByModel(f),
    getCostByPurpose(f),
    prisma.job.findMany({ select: { id: true, title: true, location: true }, orderBy: { createdAt: "desc" } }),
  ])

  const cachedShare = totals.inputTokens ? Math.round((totals.cacheReadTokens / totals.inputTokens) * 100) : 0
  const pageHref = (p) => {
    const next = new URLSearchParams(Object.entries(sp).filter(([k, v]) => k !== "page" && typeof v === "string" && v))
    next.set("tab", "interviews")
    if (p > 1) next.set("page", String(p))
    return `/admin/ai-cost?${next}`
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">AI Cost</h2>
        <p className="text-sm text-muted-foreground">
          Calculated from the real token usage of every AI call and the prices in Settings → Model pricing.
        </p>
      </div>

      <CostFilters jobs={jobs} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total AI cost" value={inr.format(totals.costInr)} hint={usd.format(totals.costUsd)} />
        <Stat label="Interviews with AI usage" value={totals.interviews} hint={`${totals.completed} completed`} />
        <Stat
          label="Average per completed interview"
          value={totals.completed ? inr.format(totals.avgCompletedInr) : "—"}
          hint={totals.completed ? usd.format(totals.avgCompletedUsd) : "No completed interviews"}
        />
        <Stat
          label="AI calls"
          value={totals.calls.toLocaleString("en-IN")}
          hint={`${compact.format(totals.inputTokens)} in · ${compact.format(totals.outputTokens)} out · ${cachedShare}% input from cache`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>AI cost per day (₹)</CardTitle>
          <CardDescription>
            {dayFmt.format(new Date(series.from))} – {dayFmt.format(new Date(series.to))} · India time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DailyCostChart days={series.days} />
        </CardContent>
      </Card>

      <Tabs defaultValue={f.tab}>
        <TabsList>
          <TabsTrigger value="interviews">Per interview</TabsTrigger>
          <TabsTrigger value="job">By job</TabsTrigger>
          <TabsTrigger value="day">By day</TabsTrigger>
          <TabsTrigger value="month">By month</TabsTrigger>
          <TabsTrigger value="model">By provider & model</TabsTrigger>
          <TabsTrigger value="purpose">By purpose</TabsTrigger>
        </TabsList>

        <TabsContent value="interviews">
          <Card className="py-0">
            <BreakdownTable
              heads={["Candidate", "Job", "Provider / model", "Messages", "Duration", "Date", ...MONEY_HEADS]}
              rows={perInterview.rows}
              render={(r) => (
                <TableRow key={r.id}>
                  <TableCell className="pl-4">
                    <Link href={`/admin/candidates/${r.candidateId}`} className="font-medium hover:underline">
                      {r.name || <span className="text-muted-foreground italic">No name</span>}
                    </Link>
                    {r.status !== "COMPLETED" && (
                      <Badge variant="outline" className="ml-1.5 text-[10px]">
                        {r.status === "IN_PROGRESS" ? "In progress" : r.status.toLowerCase()}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{r.jobTitle}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {COST_PROVIDER_LABELS[r.provider]}
                    <div className="text-xs">{r.model}</div>
                  </TableCell>
                  <TableCell className="tabular-nums">{r.messages}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatDuration(r.startedAt, r.endedAt) ?? "—"}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{dateTime.format(r.startedAt)}</TableCell>
                  <MoneyCells r={r} />
                </TableRow>
              )}
            />
          </Card>
          {perInterview.pages > 1 && (
            <div className="mt-3 flex items-center justify-end gap-2 text-sm">
              <span className="text-muted-foreground">
                Page {f.page} of {perInterview.pages}
              </span>
              <Link href={pageHref(f.page - 1)} className={cn(buttonVariants({ variant: "outline", size: "sm" }), f.page <= 1 && "pointer-events-none opacity-50")}>
                <ChevronLeft />
                Previous
              </Link>
              <Link href={pageHref(f.page + 1)} className={cn(buttonVariants({ variant: "outline", size: "sm" }), f.page >= perInterview.pages && "pointer-events-none opacity-50")}>
                Next
                <ChevronRight />
              </Link>
            </div>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Each interview&apos;s cost includes chat turns, question translation, summary and server voice. Job-level costs
            (screening question generation) appear under &ldquo;By job&rdquo; and &ldquo;By purpose&rdquo;.
          </p>
        </TabsContent>

        <TabsContent value="job">
          <Card className="py-0">
            <BreakdownTable
              heads={["Job", "Interviews", ...MONEY_HEADS]}
              rows={byJob}
              totals={totals}
              render={(r) => (
                <TableRow key={r.id}>
                  <TableCell className="pl-4">
                    <Link href={`/admin/jobs/${r.id}`} className="font-medium hover:underline">
                      {r.title}
                    </Link>
                    <div className="text-xs text-muted-foreground">{r.location}</div>
                  </TableCell>
                  <TableCell className="tabular-nums">{r.interviews}</TableCell>
                  <MoneyCells r={r} />
                </TableRow>
              )}
            />
          </Card>
        </TabsContent>

        <TabsContent value="day">
          <Card className="py-0">
            <BreakdownTable
              heads={["Day", "Interviews", ...MONEY_HEADS]}
              rows={byDay}
              totals={totals}
              render={(r) => (
                <TableRow key={r.period}>
                  <TableCell className="pl-4">{dayFmt.format(new Date(r.period))}</TableCell>
                  <TableCell className="tabular-nums">{r.interviews}</TableCell>
                  <MoneyCells r={r} />
                </TableRow>
              )}
            />
          </Card>
        </TabsContent>

        <TabsContent value="month">
          <Card className="py-0">
            <BreakdownTable
              heads={["Month", "Interviews", ...MONEY_HEADS]}
              rows={byMonth}
              totals={totals}
              render={(r) => (
                <TableRow key={r.period}>
                  <TableCell className="pl-4">{monthFmt.format(new Date(`${r.period}-01`))}</TableCell>
                  <TableCell className="tabular-nums">{r.interviews}</TableCell>
                  <MoneyCells r={r} />
                </TableRow>
              )}
            />
          </Card>
        </TabsContent>

        <TabsContent value="model">
          <Card className="py-0">
            <BreakdownTable
              heads={["Provider", "Model", "Interviews", ...MONEY_HEADS]}
              rows={byModel}
              totals={totals}
              render={(r) => (
                <TableRow key={`${r.provider}:${r.model}`}>
                  <TableCell className="pl-4">{COST_PROVIDER_LABELS[r.provider]}</TableCell>
                  <TableCell>
                    {modelLabel(r.provider, r.model)}
                    {r.model.startsWith("tts") && <div className="text-xs text-muted-foreground">input = characters</div>}
                  </TableCell>
                  <TableCell className="tabular-nums">{r.interviews}</TableCell>
                  <MoneyCells r={r} />
                </TableRow>
              )}
            />
          </Card>
        </TabsContent>

        <TabsContent value="purpose">
          <Card className="py-0">
            <BreakdownTable
              heads={["Purpose", "Calls", ...MONEY_HEADS]}
              rows={byPurpose}
              totals={totals}
              render={(r) => (
                <TableRow key={r.purpose}>
                  <TableCell className="pl-4">{PURPOSE_LABELS[r.purpose] ?? r.purpose}</TableCell>
                  <TableCell className="tabular-nums">{r.calls}</TableCell>
                  <MoneyCells r={r} />
                </TableRow>
              )}
            />
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
