"use client"

import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

// Editable ordered list of questions (empty rows are dropped on save by the schema)
export function QuestionListEditor({ value = [], onChange, max = 10, placeholder = "Type a question" }) {
  function update(index, text) {
    onChange(value.map((q, i) => (i === index ? text : q)))
  }

  return (
    <div className="space-y-2">
      {value.map((question, index) => (
        <div key={index} className="flex items-center gap-2">
          <span className="w-5 shrink-0 text-right text-sm text-muted-foreground tabular-nums">{index + 1}.</span>
          <Input
            value={question}
            placeholder={placeholder}
            aria-label={`Question ${index + 1}`}
            onChange={(e) => update(index, e.target.value)}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Remove question ${index + 1}`}
            onClick={() => onChange(value.filter((_, i) => i !== index))}
          >
            <Trash2 />
          </Button>
        </div>
      ))}
      {value.length < max && (
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...value, ""])}>
          <Plus />
          Add question
        </Button>
      )}
    </div>
  )
}
