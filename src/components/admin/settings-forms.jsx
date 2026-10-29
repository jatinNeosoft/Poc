"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PROVIDER_LABELS } from "@/lib/ai/models"

/** PUT one settings section; returns field errors (if any). */
function useSaveSection(section, successMessage) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})

  async function save(value) {
    setSaving(true)
    setFieldErrors({})
    const res = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section, ...value }),
    })
    const body = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) {
      setFieldErrors(body.fieldErrors ?? {})
      return toast.error(body.error || "Could not save")
    }
    toast.success(successMessage)
    router.refresh()
  }
  return { save, saving, fieldErrors }
}

function SimpleSelect({ id, value, onChange, items, invalid }) {
  return (
    <Select value={value} onValueChange={onChange} items={items}>
      <SelectTrigger id={id} className="w-full" aria-invalid={invalid}>
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

function SaveButton({ saving, dirty }) {
  return (
    <Button type="submit" disabled={saving || !dirty}>
      {saving && <Loader2 className="animate-spin" />}
      Save
    </Button>
  )
}

const FieldError = ({ messages }) => (messages?.length ? <p className="text-sm text-destructive">{messages[0]}</p> : null)

export function AiDefaultsForm({ value, models }) {
  const [form, setForm] = useState(value)
  const { save, saving, fieldErrors } = useSaveSection("ai", "AI defaults saved")
  const dirty = JSON.stringify(form) !== JSON.stringify(value)
  const options = (provider) => models[provider].map((m) => ({ value: m.id, label: m.label }))

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        save(form)
      }}
    >
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="ai-provider">Default provider</Label>
          <SimpleSelect
            id="ai-provider"
            value={form.provider}
            onChange={(provider) => setForm({ ...form, provider })}
            items={Object.entries(PROVIDER_LABELS).map(([v, l]) => ({ value: v, label: l }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ai-claude">Default Claude model</Label>
          <SimpleSelect
            id="ai-claude"
            value={form.claudeModel}
            onChange={(claudeModel) => setForm({ ...form, claudeModel })}
            items={options("CLAUDE")}
            invalid={!!fieldErrors.claudeModel}
          />
          <FieldError messages={fieldErrors.claudeModel} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ai-openai">Default OpenAI model</Label>
          <SimpleSelect
            id="ai-openai"
            value={form.openaiModel}
            onChange={(openaiModel) => setForm({ ...form, openaiModel })}
            items={options("OPENAI")}
            invalid={!!fieldErrors.openaiModel}
          />
          <FieldError messages={fieldErrors.openaiModel} />
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Used by jobs set to &ldquo;Default&rdquo;. Interviews already started keep the model they began with.
        </p>
        <SaveButton saving={saving} dirty={dirty} />
      </div>
    </form>
  )
}

const TTS_MODE_INFO = {
  auto: { label: "Phone voice first (recommended)", hint: "Free phone voice when the phone has one for the language; otherwise the server voice." },
  browser: { label: "Phone voice only", hint: "Never costs anything. Phones without a matching voice show text only." },
  server: { label: "Always server voice", hint: "Same voice on every phone. Costs about ₹0.13 per AI message (OpenAI tts-1)." },
}

export function VoiceSettingsForm({ value, languages, voices }) {
  const [form, setForm] = useState(value)
  const { save, saving } = useSaveSection("tts", "Voice settings saved")
  const dirty = JSON.stringify(form) !== JSON.stringify(value)

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault()
        save(form)
      }}
    >
      <RadioGroup value={form.mode} onValueChange={(mode) => setForm({ ...form, mode })} className="gap-3">
        {Object.entries(TTS_MODE_INFO).map(([mode, info]) => (
          <Label key={mode} className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 font-normal has-data-checked:border-primary">
            <RadioGroupItem value={mode} className="mt-0.5" />
            <span>
              <span className="block font-medium">{info.label}</span>
              <span className="block text-xs text-muted-foreground">{info.hint}</span>
            </span>
          </Label>
        ))}
      </RadioGroup>

      <div className="space-y-2">
        <p className="text-sm font-medium">Server voice per language</p>
        <div className="grid gap-3 md:grid-cols-3">
          {languages.map((l) => (
            <div key={l.code} className="space-y-1.5">
              <Label htmlFor={`voice-${l.code}`} className="text-muted-foreground">
                {l.name} ({l.nativeName})
              </Label>
              <SimpleSelect
                id={`voice-${l.code}`}
                value={form.voices[l.code] ?? l.fileVoice}
                onChange={(v) => setForm({ ...form, voices: { ...form.voices, [l.code]: v } })}
                items={voices.map((v) => ({ value: v, label: v === l.fileVoice ? `${v} (language file default)` : v }))}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <SaveButton saving={saving} dirty={dirty} />
      </div>
    </form>
  )
}

export function CurrencyForm({ value }) {
  const [rate, setRate] = useState(String(value))
  const { save, saving, fieldErrors } = useSaveSection("currency", "Exchange rate saved")
  const number = Number(rate)

  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        save({ usdToInr: number })
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="usd-inr">₹ per 1 US$</Label>
        <Input
          id="usd-inr"
          type="number"
          step="0.01"
          min="1"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          className="w-36"
          aria-invalid={!!fieldErrors.usdToInr}
        />
        <FieldError messages={fieldErrors.usdToInr} />
      </div>
      <SaveButton saving={saving} dirty={Number.isFinite(number) && number > 0 && number !== value} />
      <p className="basis-full text-xs text-muted-foreground">
        Used for new AI calls. Past costs keep the rate they were recorded with.
      </p>
    </form>
  )
}
