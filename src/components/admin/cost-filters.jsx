"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PROVIDER_LABELS } from "@/lib/ai/models"

const ALL = "ALL"

// Today in India time as YYYY-MM-DD
function istDate(offsetDays = 0) {
  return new Date(Date.now() + 5.5 * 3600_000 + offsetDays * 86_400_000).toISOString().slice(0, 10)
}

const PRESETS = [
  { label: "Last 7 days", from: () => istDate(-6), to: () => "" },
  { label: "Last 30 days", from: () => istDate(-29), to: () => "" },
  { label: "This month", from: () => `${istDate().slice(0, 8)}01`, to: () => "" },
  { label: "All time", from: () => "", to: () => "" },
]

function FilterSelect({ label, value, onChange, options }) {
  const items = [{ value: ALL, label: `All ${label.toLowerCase()}` }, ...options]
  return (
    <Select value={value || ALL} onValueChange={(v) => onChange(v === ALL ? "" : v)} items={items}>
      <SelectTrigger aria-label={label} className="w-full sm:w-48">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((i) => (
          <SelectItem key={i.value} value={i.value}>
            {i.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** Date range presets + custom dates, provider and job — all kept in the URL. */
export function CostFilters({ jobs }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  function update(changes) {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    next.delete("page")
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false })
  }

  const from = params.get("from") ?? ""
  const to = params.get("to") ?? ""

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3">
      <div className="flex flex-wrap gap-1">
        {PRESETS.map((p) => {
          const active = from === p.from() && to === p.to()
          return (
            <Button
              key={p.label}
              size="sm"
              variant={active ? "secondary" : "ghost"}
              className={cn(active && "font-semibold")}
              onClick={() => update({ from: p.from(), to: p.to() })}
            >
              {p.label}
            </Button>
          )
        })}
      </div>
      <div className="flex items-center gap-1.5">
        <Input type="date" aria-label="From date" value={from} onChange={(e) => update({ from: e.target.value })} className="w-36" />
        <span className="text-muted-foreground">–</span>
        <Input type="date" aria-label="To date" value={to} onChange={(e) => update({ to: e.target.value })} className="w-36" />
      </div>
      <FilterSelect
        label="Providers"
        value={params.get("provider")}
        onChange={(v) => update({ provider: v })}
        options={Object.entries(PROVIDER_LABELS).map(([value, label]) => ({ value, label }))}
      />
      <FilterSelect
        label="Jobs"
        value={params.get("job")}
        onChange={(v) => update({ job: v })}
        options={jobs.map((j) => ({ value: j.id, label: `${j.title} — ${j.location}` }))}
      />
    </div>
  )
}
