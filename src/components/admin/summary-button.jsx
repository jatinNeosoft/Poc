"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

// Generate (or regenerate) the AI summary + fit score
export function SummaryButton({ candidateId, hasSummary }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function run() {
    setBusy(true)
    const res = await fetch(`/api/admin/candidates/${candidateId}/summary`, { method: "POST" })
    const body = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) return toast.error(body.error || "Could not create the summary", { duration: 10000 })
    toast.success("Summary updated")
    router.refresh()
  }

  return (
    <Button variant={hasSummary ? "ghost" : "default"} size="sm" disabled={busy} onClick={run}>
      {busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
      {hasSummary ? "Regenerate" : "Generate summary"}
    </Button>
  )
}
