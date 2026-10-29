"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CANDIDATE_STATUS } from "@/lib/candidates/format"

const ITEMS = Object.entries(CANDIDATE_STATUS).map(([value, s]) => ({ value, label: s.label }))

// Inline New / Shortlisted / Rejected picker; saves immediately
export function CandidateStatusSelect({ candidateId, status, size = "sm" }) {
  const router = useRouter()
  const [value, setValue] = useState(status)
  const [saving, setSaving] = useState(false)

  async function change(next) {
    if (next === value) return
    const previous = value
    setValue(next)
    setSaving(true)
    const res = await fetch(`/api/admin/candidates/${candidateId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    })
    setSaving(false)
    if (!res.ok) {
      setValue(previous)
      return toast.error("Could not change the status")
    }
    toast.success(`Marked as ${CANDIDATE_STATUS[next].label}`)
    router.refresh()
  }

  return (
    <Select value={value} onValueChange={change} items={ITEMS} disabled={saving}>
      <SelectTrigger
        size={size}
        aria-label="Candidate status"
        className={cn("w-32 border-transparent font-medium", CANDIDATE_STATUS[value].className)}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ITEMS.map((i) => (
          <SelectItem key={i.value} value={i.value}>
            {i.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
