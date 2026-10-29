import Link from "next/link"
import { ChevronLeft, ChevronRight, Flag, Users, Video } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CandidateFilters } from "@/components/admin/candidate-filters"
import { CandidateStatusSelect } from "@/components/admin/candidate-status-select"
import { FitScoreBadge } from "@/components/admin/fit-score-badge"
import { listCandidates, parseCandidateFilters } from "@/lib/candidates/query"
import { dateTimeFmt, formatExperience } from "@/lib/candidates/format"
import { getLanguages } from "@/lib/languages"

export const dynamic = "force-dynamic"
export const metadata = { title: "Candidates — HireVoice" }

export default async function CandidatesPage({ searchParams }) {
  const sp = await searchParams
  const filters = parseCandidateFilters(sp)
  const [{ total, rows, pages }, jobs] = await Promise.all([
    listCandidates(filters),
    prisma.job.findMany({ select: { id: true, title: true, location: true }, orderBy: { createdAt: "desc" } }),
  ])
  const languages = getLanguages().map((l) => ({ code: l.code, name: l.name }))
  const langName = Object.fromEntries(languages.map((l) => [l.code, l.name]))

  const pageHref = (p) => {
    const next = new URLSearchParams(Object.entries(sp).filter(([k, v]) => k !== "page" && typeof v === "string" && v))
    if (p > 1) next.set("page", String(p))
    return `/admin/candidates${next.size ? `?${next}` : ""}`
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Candidates</h2>
        <p className="text-sm text-muted-foreground">
          {total} application{total === 1 ? "" : "s"} from AI interviews
        </p>
      </div>

      <CandidateFilters jobs={jobs} languages={languages} />

      {rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
            <Users className="size-8" />
            <p>No candidates match these filters.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Job</TableHead>
                <TableHead>Experience</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Fit</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Interview</TableHead>
                <TableHead className="pr-4 text-center">Video</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="pl-4">
                    <Link href={`/admin/candidates/${c.id}`} className="font-medium hover:underline">
                      {c.fullName || <span className="text-muted-foreground italic">Not given yet</span>}
                    </Link>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      {c.interview.status === "IN_PROGRESS" && (
                        <Badge variant="outline" className="text-[10px]">
                          In progress
                        </Badge>
                      )}
                      {c.flaggedCount > 0 && (
                        <span className="flex items-center gap-0.5 text-xs text-rose-600" title="Flagged answers">
                          <Flag className="size-3" />
                          {c.flaggedCount}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="tabular-nums">{c.phone ?? "—"}</TableCell>
                  <TableCell>
                    <Link href={`/admin/jobs/${c.job.id}`} className="hover:underline">
                      {c.job.title}
                    </Link>
                  </TableCell>
                  <TableCell>{formatExperience(c.totalExperienceYears)}</TableCell>
                  <TableCell className="max-w-40 truncate" title={c.city ?? ""}>
                    {c.city ?? "—"}
                  </TableCell>
                  <TableCell>
                    <FitScoreBadge score={c.fitScore} />
                  </TableCell>
                  <TableCell>
                    <CandidateStatusSelect candidateId={c.id} status={c.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <div>{dateTimeFmt.format(c.interview.startedAt)}</div>
                    <div className="text-xs">{langName[c.interview.language] ?? c.interview.language}</div>
                  </TableCell>
                  <TableCell className="pr-4 text-center">
                    {c.video ? (
                      <Video className="mx-auto size-4 text-emerald-600" aria-label="Has video" />
                    ) : (
                      <span className="text-muted-foreground">No</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <span className="text-muted-foreground">
            Page {filters.page} of {pages}
          </span>
          <Link
            href={pageHref(filters.page - 1)}
            aria-disabled={filters.page <= 1}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), filters.page <= 1 && "pointer-events-none opacity-50")}
          >
            <ChevronLeft />
            Previous
          </Link>
          <Link
            href={pageHref(filters.page + 1)}
            aria-disabled={filters.page >= pages}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), filters.page >= pages && "pointer-events-none opacity-50")}
          >
            Next
            <ChevronRight />
          </Link>
        </div>
      )}
    </div>
  )
}
