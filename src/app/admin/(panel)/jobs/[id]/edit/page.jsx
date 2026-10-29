import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { JobForm } from "@/components/admin/job-form"
import { resolveAI } from "@/lib/ai/models"
import { getModelOptions } from "@/lib/ai/catalog"
import { getAISettings } from "@/lib/settings"

export const dynamic = "force-dynamic"
export const metadata = { title: "Edit job — HireVoice" }

export default async function EditJobPage({ params }) {
  const { id } = await params
  const job = await prisma.job.findUnique({ where: { id } })
  if (!job) notFound()

  const [defaults, models] = await Promise.all([
    getAISettings(),
    getModelOptions({ provider: job.aiProvider, model: job.aiModel }), // keep its model even if deactivated
  ])

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Edit job</h2>
        <p className="text-sm text-muted-foreground">The public link and QR code stay the same after editing.</p>
      </div>
      <JobForm job={job} defaultAI={resolveAI(null, defaults)} models={models} />
    </div>
  )
}
