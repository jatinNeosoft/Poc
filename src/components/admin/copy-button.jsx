"use client"

import { useState } from "react"
import { Check, Copy } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

export function CopyButton({ text, label = "Copy link" }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success("Link copied")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Could not copy. Select the link and copy it manually.")
    }
  }

  return (
    <Button type="button" variant="ghost" size="icon-sm" aria-label={label} onClick={copy}>
      {copied ? <Check /> : <Copy />}
    </Button>
  )
}
