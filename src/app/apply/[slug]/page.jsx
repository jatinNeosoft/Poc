import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { formatSalary } from "@/lib/jobs/format"

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }) {
  const { slug } = await params
  const job = await prisma.job.findUnique({ where: { slug }, select: { title: true } })
  return { title: job ? `${job.title} — Apply` : "Job not found" }
}

// Placeholder until the AI interview is built in Phase 3
export default async function ApplyPage({ params }) {
  const { slug } = await params
  const job = await prisma.job.findUnique({ where: { slug } })
  if (!job) notFound()

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 bg-muted/40 p-6 text-center">
      <h1 className="text-3xl font-bold">{job.title}</h1>
      <p className="text-lg text-muted-foreground">
        {job.location} · {formatSalary(job.salaryMin, job.salaryMax)}
      </p>
      {job.status === "CLOSED" ? (
        <p className="rounded-xl bg-amber-500/10 px-5 py-4 text-xl font-medium text-amber-800">
          यह नौकरी बंद हो गई है।
          <br />
          This job is closed.
        </p>
      ) : (
        <p className="rounded-xl bg-background px-5 py-4 text-lg shadow-sm">
          AI इंटरव्यू जल्द शुरू होगा।
          <br />
          The AI interview will start here (Phase 3).
        </p>
      )}
    </main>
  )
}
