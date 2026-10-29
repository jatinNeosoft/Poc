import { BriefcaseBusiness, CalendarCheck, IndianRupee, Users } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export const dynamic = "force-dynamic"
export const metadata = { title: "Dashboard — HireVoice" }

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 })
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 4 })

async function getStats() {
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)

  const [jobs, openJobs, candidates, todaysInterviews, cost] = await Promise.all([
    prisma.job.count(),
    prisma.job.count({ where: { status: "OPEN" } }),
    prisma.candidate.count(),
    prisma.interview.count({ where: { startedAt: { gte: startOfToday } } }),
    prisma.aIUsage.aggregate({ _sum: { costUsd: true, costInr: true } }),
  ])

  return {
    jobs,
    openJobs,
    candidates,
    todaysInterviews,
    costUsd: Number(cost._sum.costUsd ?? 0),
    costInr: Number(cost._sum.costInr ?? 0),
  }
}

export default async function DashboardPage() {
  const s = await getStats()

  const cards = [
    { title: "Jobs", value: s.jobs, hint: `${s.openJobs} open`, icon: BriefcaseBusiness },
    { title: "Candidates", value: s.candidates, hint: "All applications", icon: Users },
    { title: "Today's interviews", value: s.todaysInterviews, hint: "Started today", icon: CalendarCheck },
    { title: "Total AI cost", value: inr.format(s.costInr), hint: usd.format(s.costUsd), icon: IndianRupee },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Dashboard</h2>
        <p className="text-sm text-muted-foreground">Overview of hiring activity</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.title}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardDescription>{c.title}</CardDescription>
              <c.icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <CardTitle className="text-3xl font-semibold tabular-nums">{c.value}</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">{c.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
