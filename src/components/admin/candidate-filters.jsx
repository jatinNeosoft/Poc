"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const ALL = "ALL" // Select needs a non-empty value for "no filter"

function FilterSelect({ id, label, value, onChange, options }) {
  const items = [{ value: ALL, label: `All ${label.toLowerCase()}` }, ...options]
  return (
    <Select value={value || ALL} onValueChange={(v) => onChange(v === ALL ? "" : v)} items={items}>
      <SelectTrigger id={id} aria-label={label} className="w-full">
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

/** Filters live in the URL so the list is shareable and survives reloads. */
export function CandidateFilters({ jobs, languages }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [q, setQ] = useState(params.get("q") ?? "")

  function update(changes) {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    next.delete("page") // new filter → back to page 1
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false })
  }

  // Search as you type, debounced
  useEffect(() => {
    if (q === (params.get("q") ?? "")) return
    const t = setTimeout(() => update({ q: q.trim() }), 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- update reads the latest params
  }, [q])

  const active = ["q", "job", "status", "lang", "from", "to", "flagged"].some((k) => params.get(k))

  return (
    <div className="grid gap-3 rounded-xl border bg-card p-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_0.8fr_0.8fr_auto_auto]">
      <div className="relative sm:col-span-2 lg:col-span-1">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name or phone"
          aria-label="Search name or phone"
          className="pl-8"
        />
      </div>
      <FilterSelect
        id="f-job"
        label="Jobs"
        value={params.get("job")}
        onChange={(v) => update({ job: v })}
        options={jobs.map((j) => ({ value: j.id, label: `${j.title} — ${j.location}` }))}
      />
      <FilterSelect
        id="f-status"
        label="Statuses"
        value={params.get("status")}
        onChange={(v) => update({ status: v })}
        options={[
          { value: "NEW", label: "New" },
          { value: "SHORTLISTED", label: "Shortlisted" },
          { value: "REJECTED", label: "Rejected" },
        ]}
      />
      <FilterSelect
        id="f-lang"
        label="Languages"
        value={params.get("lang")}
        onChange={(v) => update({ lang: v })}
        options={languages.map((l) => ({ value: l.code, label: l.name }))}
      />
      <div className="flex items-center gap-1.5">
        <Input
          type="date"
          aria-label="Interview from date"
          value={params.get("from") ?? ""}
          onChange={(e) => update({ from: e.target.value })}
          className="w-full lg:w-36"
        />
        <span className="text-muted-foreground">–</span>
        <Input
          type="date"
          aria-label="Interview to date"
          value={params.get("to") ?? ""}
          onChange={(e) => update({ to: e.target.value })}
          className="w-full lg:w-36"
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <Label className="flex items-center gap-2 font-normal whitespace-nowrap">
          <Checkbox
            checked={params.get("flagged") === "1"}
            onCheckedChange={(checked) => update({ flagged: checked ? "1" : "" })}
          />
          Flagged answers
        </Label>
        {active && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQ("")
              router.replace(pathname, { scroll: false })
            }}
          >
            <X />
            Clear
          </Button>
        )}
      </div>
    </div>
  )
}
