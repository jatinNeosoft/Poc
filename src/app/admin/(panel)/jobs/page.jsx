import Link from "next/link"
import { BriefcaseBusiness, Plus } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { JobStatusBadge } from "@/components/admin/job-status-badge"
import { JOB_TYPE_LABELS } from "@/lib/jobs/format"

export const dynamic = "force-dynamic"
export const metadata = { title: "Jobs — HireVoice" }

const FILTERS = [
  { label: "All", value: undefined },
  { label: "Open", value: "OPEN" },
  { label: "Closed", value: "CLOSED" },
]

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" })

export default async function JobsPage({ searchParams }) {
  const { status } = await searchParams
  const activeStatus = status === "OPEN" || status === "CLOSED" ? status : undefined

  const jobs = await prisma.job.findMany({
    where: activeStatus ? { status: activeStatus } : undefined,
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { candidates: true } } },
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Jobs</h2>
          <p className="text-sm text-muted-foreground">Create jobs and share the interview link or QR code</p>
        </div>
        <Link href="/admin/jobs/new" className={buttonVariants({ size: "lg" })}>
          <Plus />
          New job
        </Link>
      </div>

      <div className="flex gap-1">
        {FILTERS.map((f) => (
          <Link
            key={f.label}
            href={f.value ? `/admin/jobs?status=${f.value}` : "/admin/jobs"}
            className={cn(buttonVariants({ variant: activeStatus === f.value ? "secondary" : "ghost", size: "sm" }))}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {jobs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <BriefcaseBusiness className="size-8 text-muted-foreground" />
            <p className="text-muted-foreground">
              {activeStatus ? "No jobs with this status." : "No jobs yet. Create your first job to get a link and QR code."}
            </p>
            {!activeStatus && (
              <Link href="/admin/jobs/new" className={buttonVariants()}>
                <Plus />
                New job
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Title</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Openings</TableHead>
                <TableHead className="text-right">Applicants</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-4">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell className="pl-4 font-medium">
                    <Link href={`/admin/jobs/${job.id}`} className="hover:underline">
                      {job.title}
                    </Link>
                  </TableCell>
                  <TableCell>{job.location}</TableCell>
                  <TableCell>{JOB_TYPE_LABELS[job.jobType]}</TableCell>
                  <TableCell className="text-right tabular-nums">{job.openings}</TableCell>
                  <TableCell className="text-right tabular-nums">{job._count.candidates}</TableCell>
                  <TableCell>
                    <JobStatusBadge status={job.status} />
                  </TableCell>
                  <TableCell className="pr-4 text-muted-foreground">{dateFmt.format(job.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}
