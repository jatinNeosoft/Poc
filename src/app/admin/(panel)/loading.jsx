import { Loader2 } from "lucide-react"

// Shown while an admin page renders on the server (slow on first compile in dev)
export default function AdminLoading() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-muted-foreground">
      <Loader2 className="size-8 animate-spin" />
      <p className="text-sm">Loading…</p>
    </div>
  )
}
