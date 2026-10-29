"use client"

import { Loader2, MapPin, IndianRupee, Mic } from "lucide-react"

export function LanguagePicker({ job, languages, onPick, starting, error }) {
  return (
    <main className="mx-auto flex min-h-svh max-w-lg flex-col gap-8 px-5 py-10">
      <div className="space-y-3 rounded-3xl bg-primary px-6 py-7 text-primary-foreground">
        <h1 className="text-3xl leading-tight font-bold">{job.title}</h1>
        <p className="flex items-center gap-2 text-lg opacity-90">
          <MapPin className="size-5 shrink-0" />
          {job.location}
        </p>
        <p className="flex items-center gap-2 text-lg opacity-90">
          <IndianRupee className="size-5 shrink-0" />
          {job.salary}
        </p>
      </div>

      <div className="space-y-5">
        <div className="flex items-center justify-center gap-2 text-center text-xl font-semibold">
          <Mic className="size-6 text-primary" />
          <span>{languages.map((l) => l.labels.chooseLanguage).join(" / ")}</span>
        </div>

        <div className="grid gap-4">
          {languages.map((l) => (
            <button
              key={l.code}
              type="button"
              disabled={!!starting}
              onClick={() => onPick(l.code)}
              className="flex h-20 items-center justify-center gap-3 rounded-2xl border-2 border-primary/20 bg-card text-3xl font-bold shadow-sm transition active:scale-[0.98] active:bg-primary/5 disabled:opacity-60"
            >
              {starting === l.code && <Loader2 className="size-7 animate-spin" />}
              {l.nativeName}
            </button>
          ))}
        </div>

        {error && (
          <p role="status" className="rounded-xl bg-destructive/10 px-4 py-3 text-center text-lg text-destructive">
            {languages.map((l) => l.labels[error.label]).join(" / ")}
          </p>
        )}
      </div>
    </main>
  )
}
