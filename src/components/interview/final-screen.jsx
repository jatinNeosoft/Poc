import { CheckCircle2, Info, Lock } from "lucide-react"

export function FinalScreen({ duplicate, labels }) {
  return (
    <div className="shrink-0 border-t bg-emerald-50 px-5 pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center dark:bg-emerald-950/30">
      {duplicate ? (
        <Info className="mx-auto size-14 text-amber-500" />
      ) : (
        <CheckCircle2 className="mx-auto size-14 text-emerald-600" />
      )}
      <p className="mt-3 text-xl font-bold">{duplicate ? labels.alreadyApplied : labels.submitted}</p>
    </div>
  )
}

export function ClosedScreen({ job, languages }) {
  return (
    <main className="mx-auto flex min-h-svh max-w-lg flex-col items-center justify-center gap-5 px-6 text-center">
      <Lock className="size-14 text-muted-foreground" />
      <h1 className="text-2xl font-bold">{job.title}</h1>
      <div className="space-y-1 text-xl">
        {languages.map((l) => (
          <p key={l.code}>{l.labels.jobClosed}</p>
        ))}
      </div>
    </main>
  )
}
