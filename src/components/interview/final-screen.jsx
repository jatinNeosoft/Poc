import { Check, Info, Lock, PhoneCall } from "lucide-react"
import { cn } from "@/lib/utils"

/** Full-page "thank you" that replaces the chat once the interview is over. */
export function FinalScreen({ jobTitle, duplicate, labels }) {
  return (
    <main
      className={cn(
        "flex min-h-svh flex-col items-center justify-center px-6 py-10 text-center",
        duplicate
          ? "bg-gradient-to-b from-amber-50 to-background dark:from-amber-950/30"
          : "bg-gradient-to-b from-emerald-50 to-background dark:from-emerald-950/30"
      )}
    >
      <div className="flex w-full max-w-sm flex-col items-center">
        <div
          className={cn(
            "flex size-28 items-center justify-center rounded-full ring-8 animate-in zoom-in-50 duration-500",
            duplicate
              ? "bg-amber-500 ring-amber-100 dark:ring-amber-900/40"
              : "bg-emerald-600 ring-emerald-100 dark:ring-emerald-900/40"
          )}
        >
          {duplicate ? (
            <Info className="size-14 text-white" strokeWidth={2.5} />
          ) : (
            <Check className="size-16 text-white" strokeWidth={3} />
          )}
        </div>

        <h1 className="mt-8 text-4xl font-bold tracking-tight">{labels.thankYouTitle}</h1>
        <p className="mt-3 text-xl text-muted-foreground">{duplicate ? labels.alreadyApplied : labels.submitted}</p>

        <div className="mt-8 w-full rounded-2xl border bg-background p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">{labels.appliedFor}</p>
          <p className="mt-1 text-xl font-semibold">{jobTitle}</p>
          {!duplicate && (
            <div className="mt-4 flex items-start gap-3 border-t pt-4 text-left">
              <PhoneCall className="mt-0.5 size-6 shrink-0 text-emerald-600" />
              <p className="text-base">{labels.nextSteps}</p>
            </div>
          )}
        </div>

        <p className="mt-8 text-base text-muted-foreground">{labels.closePage}</p>
      </div>
    </main>
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
