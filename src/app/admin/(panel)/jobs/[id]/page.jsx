import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Download, ExternalLink, Pencil, Printer } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { JobStatusBadge } from "@/components/admin/job-status-badge"
import { JobStatusButton } from "@/components/admin/job-status-button"
import { CopyButton } from "@/components/admin/copy-button"
import { GeneratedQuestionsCard } from "@/components/admin/generated-questions-card"
import { formatSalary, JOB_TYPE_LABELS, publicJobUrl } from "@/lib/jobs/format"
import { PROVIDER_LABELS, resolveAI } from "@/lib/ai/models"
import { getAISettings } from "@/lib/settings"
import { qrDataUrl } from "@/lib/qr"

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }) {
  const { id } = await params
  const job = await prisma.job.findUnique({ where: { id }, select: { title: true } })
  return { title: `${job?.title ?? "Job"} — HireVoice` }
}

function Detail({ label, children }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{children}</dd>
    </div>
  )
}

export default async function JobDetailPage({ params }) {
  const { id } = await params
  const job = await prisma.job.findUnique({
    where: { id },
    include: { _count: { select: { candidates: true } } },
  })
  if (!job) notFound()

  const url = publicJobUrl(job.slug)
  const qr = await qrDataUrl(url, 320)
  const ai = resolveAI(job, await getAISettings())

  return (
    <div className="space-y-6">
      <Link href="/admin/jobs" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />
        All jobs
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-semibold tracking-tight">{job.title}</h2>
            <JobStatusBadge status={job.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {job.location} · {JOB_TYPE_LABELS[job.jobType]} · {job._count.candidates} applicant
            {job._count.candidates === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/admin/jobs/${job.id}/edit`} className={buttonVariants({ variant: "outline" })}>
            <Pencil />
            Edit
          </Link>
          <JobStatusButton jobId={job.id} status={job.status} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Job details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <dl className="grid gap-4 sm:grid-cols-3">
                <Detail label="Salary">{formatSalary(job.salaryMin, job.salaryMax)}</Detail>
                <Detail label="Openings">{job.openings}</Detail>
                <Detail label="Experience">{job.experienceRequired || "Not specified"}</Detail>
                <Detail label="AI model">
                  {PROVIDER_LABELS[ai.provider]} · {ai.model}
                  {!job.aiProvider && <span className="font-normal text-muted-foreground"> (default)</span>}
                </Detail>
              </dl>
              {job.requiredSkills.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">Required skills</p>
                  <div className="flex flex-wrap gap-1.5">
                    {job.requiredSkills.map((s) => (
                      <Badge key={s} variant="secondary">
                        {s}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">Description</p>
                <p className="whitespace-pre-line text-sm">{job.description}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Your screening questions</CardTitle>
              <CardDescription>Asked first, in the candidate&apos;s language. Change them with Edit.</CardDescription>
            </CardHeader>
            <CardContent>
              {job.customQuestions.length ? (
                <ol className="list-decimal space-y-1 pl-5 text-sm">
                  {job.customQuestions.map((q) => (
                    <li key={q}>{q}</li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted-foreground">None added.</p>
              )}
            </CardContent>
          </Card>

          <GeneratedQuestionsCard jobId={job.id} questions={job.generatedQuestions} />
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Share</CardTitle>
            <CardDescription>The link and the QR code open the same AI interview.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-center rounded-lg border bg-white p-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- data URL, nothing to optimise */}
              <img src={qr} alt={`QR code for ${url}`} width={240} height={240} />
            </div>

            <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-2 py-1.5">
              <code className="min-w-0 flex-1 truncate text-xs" title={url}>
                {url}
              </code>
              <CopyButton text={url} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <a href={`/api/admin/jobs/${job.id}/qr?download=1`} className={buttonVariants({ variant: "outline" })}>
                <Download />
                PNG
              </a>
              <Link
                href={`/admin/print/jobs/${job.id}`}
                target="_blank"
                className={buttonVariants({ variant: "outline" })}
              >
                <Printer />
                Print
              </Link>
              <Link href={`/apply/${job.slug}`} target="_blank" className={buttonVariants({ variant: "ghost" }) + " col-span-2"}>
                <ExternalLink />
                Open candidate page
              </Link>
            </div>
            {job.status === "CLOSED" && (
              <p className="rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                This job is closed. The link shows a &ldquo;job closed&rdquo; message until you reopen it.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
