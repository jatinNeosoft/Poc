"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Pencil, Plus } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { COST_PROVIDER_LABELS, isTtsModel as isTts, modelLabel } from "@/lib/ai/models"

const usd = (n) => `$${Number(n).toFixed(Number(n) < 1 ? 3 : 2)}`

async function send(url, method, body) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  return { ok: res.ok, body: await res.json().catch(() => ({})) }
}

/** Add / edit dialog. `row` given → edit prices of that row, else create a new model price. */
function PricingDialog({ open, onOpenChange, row }) {
  const router = useRouter()
  const [form, setForm] = useState(() =>
    row
      ? { input: String(Number(row.inputPerMillionUsd)), output: String(Number(row.outputPerMillionUsd)) }
      : { provider: "CLAUDE", model: "", input: "", output: "" }
  )
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    setErrors({})
    const prices = { inputPerMillionUsd: Number(form.input), outputPerMillionUsd: Number(form.output) }
    const { ok, body } = row
      ? await send(`/api/admin/pricing/${row.id}`, "PATCH", prices)
      : await send("/api/admin/pricing", "POST", { provider: form.provider, model: form.model, ...prices })
    setSaving(false)
    if (!ok) {
      setErrors(body.fieldErrors ?? {})
      return toast.error(body.error || "Could not save")
    }
    toast.success(row ? "Prices updated (applies to new AI calls)" : "Model added — it can now be chosen for jobs")
    onOpenChange(false)
    router.refresh()
  }

  const err = (k) => errors[k]?.[0] && <p className="text-sm text-destructive">{errors[k][0]}</p>

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{row ? `Edit price: ${row.model}` : "Add model price"}</DialogTitle>
            <DialogDescription>
              US$ per 1 million {row && isTts(row.model) ? "characters" : "tokens"}, from the provider&apos;s pricing page.
            </DialogDescription>
          </DialogHeader>

          {!row && (
            <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
              <div className="space-y-1.5">
                <Label htmlFor="p-provider">Provider</Label>
                <Select
                  value={form.provider}
                  onValueChange={(provider) => setForm({ ...form, provider })}
                  items={Object.entries(COST_PROVIDER_LABELS).map(([value, label]) => ({ value, label }))}
                >
                  <SelectTrigger id="p-provider" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(COST_PROVIDER_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-model">Model id</Label>
                <Input
                  id="p-model"
                  value={form.model}
                  placeholder="e.g. claude-sonnet-5-5"
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                  aria-invalid={!!errors.model}
                />
                {err("model")}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="p-in">Input $ / 1M</Label>
              <Input id="p-in" type="number" step="0.0001" min="0" value={form.input} onChange={(e) => setForm({ ...form, input: e.target.value })} aria-invalid={!!errors.inputPerMillionUsd} />
              {err("inputPerMillionUsd")}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-out">Output $ / 1M</Label>
              <Input id="p-out" type="number" step="0.0001" min="0" value={form.output} onChange={(e) => setForm({ ...form, output: e.target.value })} aria-invalid={!!errors.outputPerMillionUsd} />
              {err("outputPerMillionUsd")}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || form.input === "" || form.output === "" || (!row && !form.model.trim())}>
              {saving && <Loader2 className="animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function PricingTable({ rows, defaults }) {
  const router = useRouter()
  const [editing, setEditing] = useState(null) // row | "new" | null
  const [toggling, setToggling] = useState(null)

  async function toggle(row, active) {
    setToggling(row.id)
    const { ok, body } = await send(`/api/admin/pricing/${row.id}`, "PATCH", { active })
    setToggling(null)
    if (!ok) return toast.error(body.error || "Could not update", { duration: 8000 })
    toast.success(`${row.model} ${active ? "activated" : "deactivated"}`)
    router.refresh()
  }

  const isDefault = (r) =>
    (r.provider === "CLAUDE" && r.model === defaults.claudeModel) || (r.provider === "OPENAI" && r.model === defaults.openaiModel)

  return (
    <div className="space-y-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Provider</TableHead>
            <TableHead>Model</TableHead>
            <TableHead className="text-right">Input $ / 1M</TableHead>
            <TableHead className="text-right">Output $ / 1M</TableHead>
            <TableHead>Active</TableHead>
            <TableHead className="pr-4 text-right">
              <span className="sr-only">Edit</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id} className={r.active ? "" : "text-muted-foreground"}>
              <TableCell className="pl-4">{COST_PROVIDER_LABELS[r.provider]}</TableCell>
              <TableCell>
                <div className="flex items-center gap-1.5">
                  <span className="font-medium">{modelLabel(r.provider, r.model)}</span>
                  {isDefault(r) && <Badge variant="secondary">Default</Badge>}
                  {isTts(r.model) && <Badge variant="outline">Voice · per 1M characters</Badge>}
                </div>
                <code className="text-xs text-muted-foreground">{r.model}</code>
              </TableCell>
              <TableCell className="text-right tabular-nums">{usd(r.inputPerMillionUsd)}</TableCell>
              <TableCell className="text-right tabular-nums">{isTts(r.model) ? "—" : usd(r.outputPerMillionUsd)}</TableCell>
              <TableCell>
                <Switch
                  checked={r.active}
                  disabled={toggling === r.id}
                  onCheckedChange={(checked) => toggle(r, checked)}
                  aria-label={`${r.model} active`}
                />
              </TableCell>
              <TableCell className="pr-4 text-right">
                <Button variant="ghost" size="sm" onClick={() => setEditing(r)}>
                  <Pencil />
                  Edit
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between gap-3 px-4 pb-1">
        <p className="text-xs text-muted-foreground">
          Price changes apply to new AI calls only. Inactive models cannot be chosen for new jobs.
        </p>
        <Button size="sm" onClick={() => setEditing("new")}>
          <Plus />
          Add model
        </Button>
      </div>

      {editing && (
        <PricingDialog
          key={editing === "new" ? "new" : editing.id}
          open
          onOpenChange={(o) => !o && setEditing(null)}
          row={editing === "new" ? null : editing}
        />
      )}
    </div>
  )
}
