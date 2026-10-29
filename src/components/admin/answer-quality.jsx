import { AlertTriangle, CheckCircle2, CircleHelp, Flag, TrendingDown, TrendingUp, XCircle } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

const QUALITY = {
  GOOD: { icon: CheckCircle2, className: "text-emerald-600", label: "Clear answer" },
  OKAY: { icon: AlertTriangle, className: "text-amber-500", label: "Usable but vague" },
  POOR: { icon: XCircle, className: "text-rose-600", label: "Unclear answer" },
}

/**
 * ✅ / ⚠️ / ❌ for one answer, plus a fit arrow. Hover shows the AI's reasons.
 * `check` = the last AnswerCheck for the question (or a ScreeningAnswer with quality/fit), `attempts` optional.
 */
export function AnswerQuality({ check, attempts, flagged }) {
  if (!check?.quality) {
    return <CircleHelp className="size-4 text-muted-foreground/50" aria-label="Not checked" />
  }
  const isFlagged = flagged ?? check.flagged
  const q = isFlagged ? { icon: Flag, className: "text-rose-600", label: "Flagged: still unclear after 3 tries" } : QUALITY[check.quality]
  const Icon = q.icon

  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex shrink-0 cursor-help items-center gap-0.5" />}>
        <Icon className={`size-4 ${q.className}`} aria-label={q.label} />
        {check.fit === "POSITIVE" && <TrendingUp className="size-3.5 text-emerald-600" aria-label="Good fit" />}
        {check.fit === "NEGATIVE" && <TrendingDown className="size-3.5 text-rose-600" aria-label="Poor fit" />}
      </TooltipTrigger>
      <TooltipContent className="max-w-72">
        <p className="font-medium">{q.label}</p>
        {check.fit && check.fit !== "NA" && (
          <p>
            Job fit: {check.fit.toLowerCase()}
            {check.fitReason ? ` — ${check.fitReason}` : ""}
          </p>
        )}
        {attempts > 1 && <p>Asked {attempts} times</p>}
        {check.misheard && <p>Speech-to-text may have misheard</p>}
      </TooltipContent>
    </Tooltip>
  )
}
