import { RotateCw } from "lucide-react"

// Error text + optional retry, shown above the composer or the video recorder
export function ErrorBanner({ error, labels }) {
  if (!error) return null
  return (
    <div role="alert" className="mb-3 flex items-center justify-between gap-3 rounded-2xl bg-destructive/10 px-4 py-3">
      <span className="text-base text-destructive">{labels[error.label]}</span>
      {error.retry && (
        <button
          type="button"
          onClick={error.retry}
          className="flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-destructive px-4 font-semibold text-white"
        >
          <RotateCw className="size-4" />
          {labels.retry}
        </button>
      )}
    </div>
  )
}
