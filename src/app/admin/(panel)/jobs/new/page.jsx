import { JobForm } from "@/components/admin/job-form"
import { defaultModel, defaultProvider } from "@/lib/ai/models"

export const metadata = { title: "New job — HireVoice" }

export default function NewJobPage() {
  const provider = defaultProvider()

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">New job</h2>
        <p className="text-sm text-muted-foreground">
          After saving you get a public interview link and a QR code to print.
        </p>
      </div>
      <JobForm defaultAI={{ provider, model: defaultModel(provider) }} />
    </div>
  )
}
