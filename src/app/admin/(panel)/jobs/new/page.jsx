import { JobForm } from "@/components/admin/job-form"
import { resolveAI } from "@/lib/ai/models"
import { getModelOptions } from "@/lib/ai/catalog"
import { getAISettings } from "@/lib/settings"

export const dynamic = "force-dynamic"
export const metadata = { title: "New job — HireVoice" }

export default async function NewJobPage() {
  const [defaults, models] = await Promise.all([getAISettings(), getModelOptions()])

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">New job</h2>
        <p className="text-sm text-muted-foreground">
          After saving you get a public interview link and a QR code to print.
        </p>
      </div>
      <JobForm defaultAI={resolveAI(null, defaults)} models={models} />
    </div>
  )
}
