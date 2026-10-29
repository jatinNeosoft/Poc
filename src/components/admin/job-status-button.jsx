"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Lock, LockOpen } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

// Close (with confirmation) or reopen a job
export function JobStatusButton({ jobId, status }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)

  async function setStatus(next) {
    setBusy(true)
    const res = await fetch(`/api/admin/jobs/${jobId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    })
    setBusy(false)
    setOpen(false)
    if (!res.ok) return toast.error("Could not update the job")
    toast.success(next === "CLOSED" ? "Job closed" : "Job reopened")
    router.refresh()
  }

  if (status === "CLOSED") {
    return (
      <Button disabled={busy} onClick={() => setStatus("OPEN")}>
        {busy ? <Loader2 className="animate-spin" /> : <LockOpen />}
        Reopen
      </Button>
    )
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={<Button variant="destructive" />}>
        <Lock />
        Close job
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Close this job?</AlertDialogTitle>
          <AlertDialogDescription>
            New candidates will see &ldquo;This job is closed&rdquo; on the link and QR code. Existing applications are
            kept. You can reopen it any time.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={busy} onClick={() => setStatus("CLOSED")}>
            {busy && <Loader2 className="animate-spin" />}
            Close job
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
