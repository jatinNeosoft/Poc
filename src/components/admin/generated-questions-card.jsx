"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Pencil, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { QuestionListEditor } from "@/components/admin/question-list-editor"

// AI-generated screening questions: view, edit by hand, or regenerate
export function GeneratedQuestionsCard({ jobId, questions }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(questions)
  const [busy, setBusy] = useState(null) // "save" | "regenerate"

  async function save() {
    setBusy("save")
    const res = await fetch(`/api/admin/jobs/${jobId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ generatedQuestions: draft }),
    })
    setBusy(null)
    if (!res.ok) return toast.error("Could not save the questions")
    toast.success("Questions saved")
    setEditing(false)
    router.refresh()
  }

  async function regenerate() {
    if (questions.length && !confirm("Replace the current AI questions with new ones?")) return
    setBusy("regenerate")
    const res = await fetch(`/api/admin/jobs/${jobId}/generate-questions`, { method: "POST" })
    const body = await res.json().catch(() => ({}))
    setBusy(null)
    if (!res.ok) return toast.error(body.error || "Could not generate questions", { duration: 10000 })
    setDraft(body.job.generatedQuestions)
    setEditing(false)
    toast.success("New questions generated")
    router.refresh()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-4 text-violet-500" />
          AI screening questions
        </CardTitle>
        <CardDescription>Generated from the job description and asked after your questions.</CardDescription>
        {!editing && (
          <CardAction className="flex gap-1">
            <Button variant="ghost" size="sm" disabled={!!busy} onClick={() => (setDraft(questions), setEditing(true))}>
              <Pencil />
              Edit
            </Button>
            <Button variant="outline" size="sm" disabled={!!busy} onClick={regenerate}>
              {busy === "regenerate" ? <Loader2 className="animate-spin" /> : <Sparkles />}
              {questions.length ? "Regenerate" : "Generate"}
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {editing ? (
          <div className="space-y-4">
            <QuestionListEditor value={draft} onChange={setDraft} max={6} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" disabled={!!busy} onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button disabled={!!busy} onClick={save}>
                {busy === "save" && <Loader2 className="animate-spin" />}
                Save
              </Button>
            </div>
          </div>
        ) : questions.length ? (
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            {questions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground">
            No AI questions yet. Click Generate (needs the AI provider&apos;s API key in .env).
          </p>
        )}
      </CardContent>
    </Card>
  )
}
