import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Bot, Clock, Download, Flag, Globe, IndianRupee, Mic, Phone, Keyboard, Video } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CandidateStatusSelect } from "@/components/admin/candidate-status-select"
import { FitScoreBadge } from "@/components/admin/fit-score-badge"
import { AnswerQuality } from "@/components/admin/answer-quality"
import { SummaryButton } from "@/components/admin/summary-button"
import { CV_FIELDS } from "@/lib/interview/fields"
import { dateTimeFmt, formatCvValue, formatDuration, LANGUAGE_NAMES } from "@/lib/candidates/format"
import { PROVIDER_LABELS } from "@/lib/ai/models"

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }) {
  const { id } = await params
  const c = await prisma.candidate.findUnique({ where: { id }, select: { fullName: true } })
  return { title: `${c?.fullName || "Candidate"} — HireVoice` }
}

const amount = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const timeFmt = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", second: "2-digit", timeZone: "Asia/Kolkata" })

export default async function CandidateDetailPage({ params }) {
  const { id } = await params
  const candidate = await prisma.candidate.findUnique({
    where: { id },
    include: {
      job: true,
      video: true,
      screeningAnswers: { orderBy: { order: "asc" } },
      interview: {
        include: {
          messages: { orderBy: { createdAt: "asc" } },
          answerChecks: { orderBy: { createdAt: "asc" } },
        },
      },
    },
  })
  if (!candidate?.interview) notFound()

  const { interview, job } = candidate
  const cost = await prisma.aIUsage.aggregate({ where: { interviewId: interview.id }, _sum: { costInr: true } })

  // Last check per question = the one that counted; count attempts per question
  const lastCheck = new Map()
  const attempts = new Map()
  for (const c of interview.answerChecks) {
    lastCheck.set(c.target, c)
    attempts.set(c.target, (attempts.get(c.target) ?? 0) + 1)
  }
  const checkByMessage = new Map(interview.answerChecks.map((c) => [c.messageId, c]))
  const flaggedChecks = [...lastCheck.values()].filter((c) => c.flagged)
  const done = interview.status === "COMPLETED"
  const duration = formatDuration(interview.startedAt, interview.endedAt)

  return (
    <div className="space-y-6">
      <Link href="/admin/candidates" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />
        All candidates
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-semibold tracking-tight">{candidate.fullName || "Name not given"}</h2>
            <Badge variant={done ? "secondary" : "outline"}>
              {done ? "Interview completed" : interview.status === "IN_PROGRESS" ? "Interview in progress" : interview.status.toLowerCase()}
            </Badge>
          </div>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {candidate.phone && (
              <a href={`tel:+91${candidate.phone}`} className="inline-flex items-center gap-1 hover:text-foreground">
                <Phone className="size-3.5" />
                {candidate.phone}
              </a>
            )}
            <Link href={`/admin/jobs/${job.id}`} className="hover:text-foreground hover:underline">
              {job.title}
            </Link>
            <span className="inline-flex items-center gap-1">
              <Globe className="size-3.5" />
              {LANGUAGE_NAMES[interview.language] ?? interview.language}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" />
              {dateTimeFmt.format(interview.startedAt)}
              {duration && ` · ${duration}`}
            </span>
            <span className="inline-flex items-center gap-1" title="AI cost of this interview">
              <IndianRupee className="size-3.5" />
              {amount.format(Number(cost._sum.costInr ?? 0))} AI cost
            </span>
            <span className="inline-flex items-center gap-1">
              <Bot className="size-3.5" />
              {PROVIDER_LABELS[interview.provider]} · {interview.model}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CandidateStatusSelect candidateId={candidate.id} status={candidate.status} size="default" />
          <a href={`/api/admin/candidates/${candidate.id}/pdf`} className={buttonVariants({ variant: "outline" })}>
            <Download />
            CV PDF
          </a>
        </div>
      </div>

      {/* AI summary */}
      <Card>
        <CardHeader>
          <CardTitle>AI assessment</CardTitle>
          <CardDescription>Summary and fit score from the interview answers. Only you see this.</CardDescription>
          {done && (
            <CardAction>
              <SummaryButton candidateId={candidate.id} hasSummary={!!candidate.aiSummary} />
            </CardAction>
          )}
        </CardHeader>
        <CardContent>
          {candidate.aiSummary ? (
            <div className="flex gap-5">
              <FitScoreBadge score={candidate.fitScore} large />
              <div className="space-y-2 text-sm">
                <p>{candidate.aiSummary}</p>
                {candidate.fitReason && (
                  <p className="text-muted-foreground">
                    <span className="font-medium text-foreground">Why this score: </span>
                    {candidate.fitReason}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {done ? "No summary yet." : "The summary is created when the candidate finishes the interview."}
            </p>
          )}
        </CardContent>
      </Card>

      {flaggedChecks.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          <Flag className="mt-0.5 size-4 shrink-0" />
          <div>
            <span className="font-medium">
              {flaggedChecks.length} flagged answer{flaggedChecks.length === 1 ? "" : "s"}:{" "}
            </span>
            still unclear after asking 3 times — {flaggedChecks.map((c) => c.question).join("; ")}. Check by phone.
          </div>
        </div>
      )}

      <Tabs defaultValue="cv">
        <TabsList>
          <TabsTrigger value="cv">CV</TabsTrigger>
          <TabsTrigger value="screening">Screening ({candidate.screeningAnswers.length})</TabsTrigger>
          <TabsTrigger value="video">Video{candidate.video ? "" : " (none)"}</TabsTrigger>
          <TabsTrigger value="transcript">Transcript</TabsTrigger>
        </TabsList>

        {/* CV fields with answer quality */}
        <TabsContent value="cv">
          <Card>
            <CardContent>
              <dl className="divide-y">
                {CV_FIELDS.map((f) => (
                  <div key={f.key} className="grid grid-cols-[180px_1fr_auto] items-start gap-3 py-2.5 text-sm">
                    <dt className="text-muted-foreground">{f.label}</dt>
                    <dd className="whitespace-pre-line">{formatCvValue(f.key, candidate[f.key])}</dd>
                    <AnswerQuality check={lastCheck.get(f.key)} attempts={attempts.get(f.key)} />
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-xs text-muted-foreground">
                Hover the icons: ✓ clear · ⚠ vague · ✗ unclear · ⚑ flagged after 3 tries · ↑↓ good / poor fit for this job
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Screening answers */}
        <TabsContent value="screening">
          <Card>
            <CardContent>
              {candidate.screeningAnswers.length ? (
                <ol className="divide-y">
                  {candidate.screeningAnswers.map((a, i) => (
                    <li key={a.id} className="flex items-start gap-3 py-3 text-sm">
                      <span className="w-5 shrink-0 text-muted-foreground tabular-nums">{i + 1}.</span>
                      <div className="flex-1 space-y-1">
                        <p className="text-muted-foreground">
                          {a.question}
                          <Badge variant="outline" className="ml-2 text-[10px]">
                            {a.source === "custom" ? "Your question" : "AI question"}
                          </Badge>
                        </p>
                        <p className="font-medium">{a.answer}</p>
                        {a.fitReason && <p className="text-xs text-muted-foreground">{a.fitReason}</p>}
                      </div>
                      <AnswerQuality check={a} attempts={attempts.get(`screening:${a.order}`)} />
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted-foreground">No screening answers yet.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Intro video */}
        <TabsContent value="video">
          <Card>
            <CardContent>
              {candidate.video ? (
                <div className="space-y-2">
                  <video
                    src={candidate.video.url}
                    controls
                    preload="metadata"
                    playsInline
                    className="max-h-[480px] w-full max-w-md rounded-lg bg-black"
                  />
                  <p className="text-xs text-muted-foreground">
                    {candidate.video.durationSec ? `${candidate.video.durationSec} s · ` : ""}
                    {(candidate.video.sizeBytes / 1024 / 1024).toFixed(1)} MB · {candidate.video.mimeType}
                  </p>
                </div>
              ) : (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Video className="size-4" />
                  {interview.videoChoice === "NO" ? "The candidate chose not to record a video." : "No video."}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Full transcript */}
        <TabsContent value="transcript">
          <Card>
            <CardContent className="space-y-3">
              {interview.messages.map((m) => {
                if (m.role === "SYSTEM") {
                  return (
                    <p key={m.id} className="text-center text-xs text-muted-foreground italic">
                      {m.content}
                    </p>
                  )
                }
                const check = checkByMessage.get(m.id)
                const isUser = m.role === "USER"
                return (
                  <div key={m.id} className={cn("flex flex-col gap-1", isUser ? "items-end" : "items-start")}>
                    <div
                      className={cn(
                        "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm",
                        isUser ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-muted"
                      )}
                    >
                      {m.content}
                    </div>
                    <div className="flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground">
                      <span>{isUser ? "Candidate" : "AI"}</span>
                      <span>· {timeFmt.format(m.createdAt)}</span>
                      {check && (
                        <>
                          <span className="inline-flex items-center gap-0.5">
                            · {check.inputMode === "voice" ? <Mic className="size-3" /> : <Keyboard className="size-3" />}
                            {check.sttConfidence ? ` ${Math.round(check.sttConfidence * 100)}%` : ""}
                          </span>
                          <span>· {check.target}</span>
                          <AnswerQuality check={check} />
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
