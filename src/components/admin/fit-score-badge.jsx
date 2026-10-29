import { cn } from "@/lib/utils"
import { fitTone } from "@/lib/candidates/format"

const TONES = {
  good: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  mid: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  low: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
  muted: "bg-muted text-muted-foreground",
}

// AI fit score 1–10 (green ≥ 8, amber 5–7, red < 5)
export function FitScoreBadge({ score, large = false }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full font-semibold tabular-nums",
        large ? "size-16 text-2xl" : "h-6 min-w-9 px-2 text-xs",
        TONES[fitTone(score)]
      )}
      title={score ? `AI fit score ${score}/10` : "No fit score yet"}
    >
      {score ?? "–"}
      {large && score ? <span className="text-sm font-normal opacity-70">/10</span> : null}
    </span>
  )
}
