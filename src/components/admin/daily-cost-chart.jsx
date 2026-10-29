const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 })
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 4 })
const dayLabel = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" })

// Round the axis top up to 1 / 2 / 2.5 / 5 × 10^k so tick labels are readable
function niceCeil(v) {
  if (v <= 0) return 0
  const pow = 10 ** Math.floor(Math.log10(v))
  return [1, 2, 2.5, 5, 10].map((m) => m * pow).find((n) => n >= v)
}

/**
 * Single-series column chart of AI cost (₹) per day. One blue (--chart-bar), no legend
 * (the title names the series), recessive grid, hover/focus tooltip per day.
 * The "By day" table on the same page is the accessible table view.
 */
export function DailyCostChart({ days }) {
  const max = Math.max(0, ...days.map((d) => d.costInr))
  if (max === 0) {
    return <p className="flex h-56 items-center justify-center text-sm text-muted-foreground">No AI usage in this period.</p>
  }

  const top = niceCeil(max)
  const ticks = [top, top / 2, 0]
  const labelEvery = Math.ceil(days.length / 8)

  return (
    <div className="flex gap-2" role="img" aria-label={`Bar chart of AI cost per day, highest ${inr.format(max)}`}>
      {/* y-axis labels */}
      <div className="relative h-56 w-14 shrink-0 text-right text-[11px] text-muted-foreground tabular-nums">
        {ticks.map((t, i) => (
          <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: `${(i / (ticks.length - 1)) * 100}%` }}>
            {inr.format(t)}
          </span>
        ))}
      </div>

      <div className="min-w-0 flex-1">
        <div className="relative h-56">
          {/* gridlines */}
          {ticks.map((t, i) => (
            <div
              key={t}
              className={i === ticks.length - 1 ? "absolute inset-x-0 border-t border-foreground/30" : "absolute inset-x-0 border-t border-border/70"}
              style={{ top: `${(i / (ticks.length - 1)) * 100}%` }}
            />
          ))}

          {/* bars: whole column is the hover/focus target */}
          <div className="absolute inset-0 flex items-end gap-[2px]">
            {days.map((d, i) => {
              const pct = (d.costInr / top) * 100
              // Keep tooltips inside the card: anchor to the bar's inner side near the edges
              const edge = i < days.length / 4 ? "left-0" : i >= (days.length * 3) / 4 ? "right-0" : "left-1/2 -translate-x-1/2"
              return (
                <div
                  key={d.day}
                  tabIndex={0}
                  aria-label={`${dayLabel.format(new Date(d.day))}: ${inr.format(d.costInr)}`}
                  className="group relative flex h-full flex-1 items-end justify-center outline-none"
                >
                  <div
                    className="w-full max-w-6 rounded-t-[4px] bg-[var(--chart-bar)] transition-opacity group-hover:opacity-80 group-focus-visible:opacity-80"
                    style={{ height: d.costInr > 0 ? `max(${pct}%, 2px)` : 0 }}
                  />
                  <div className={`pointer-events-none absolute bottom-full ${edge} z-10 mb-1 hidden rounded-md border bg-popover px-2.5 py-1.5 text-xs whitespace-nowrap text-popover-foreground shadow-md group-hover:block group-focus-visible:block`}>
                    <p className="font-medium">{dayLabel.format(new Date(d.day))}</p>
                    <p className="tabular-nums">
                      {inr.format(d.costInr)} <span className="text-muted-foreground">· {usd.format(d.costUsd)}</span>
                    </p>
                    <p className="text-muted-foreground">{d.calls} AI calls</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* x-axis labels (every few days) */}
        <div className="mt-1.5 flex gap-[2px] text-[11px] text-muted-foreground">
          {days.map((d, i) => (
            <div key={d.day} className="flex-1 overflow-visible text-center whitespace-nowrap">
              {i % labelEvery === 0 ? dayLabel.format(new Date(d.day)) : ""}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
