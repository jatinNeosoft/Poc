"use client"

import { useState } from "react"
import { X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"

// Type a value and press Enter or comma to add it as a chip
export function TagInput({ id, value = [], onChange, placeholder, invalid }) {
  const [draft, setDraft] = useState("")

  function add(raw) {
    const items = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
    if (!items.length) return
    const existing = new Set(value.map((v) => v.toLowerCase()))
    onChange([...value, ...items.filter((i) => !existing.has(i.toLowerCase()))])
    setDraft("")
  }

  function onKeyDown(e) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      add(draft)
    } else if (e.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1))
    }
  }

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1 pr-1">
              {tag}
              <button
                type="button"
                aria-label={`Remove ${tag}`}
                className="rounded-sm p-0.5 hover:bg-foreground/10"
                onClick={() => onChange(value.filter((t) => t !== tag))}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <Input
        id={id}
        value={draft}
        aria-invalid={invalid}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => add(draft)}
      />
    </div>
  )
}
