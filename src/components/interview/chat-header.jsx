"use client"

import { Volume2, VolumeX } from "lucide-react"

export function ChatHeader({ title, percent, voiceOn, onToggleVoice, labels }) {
  return (
    <header className="shrink-0 space-y-2 border-b px-4 pt-3 pb-3">
      <div className="flex items-center justify-between gap-3">
        <h1 className="truncate text-lg font-bold">{title}</h1>
        <button
          type="button"
          onClick={onToggleVoice}
          aria-pressed={voiceOn}
          className="flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-medium active:bg-muted"
        >
          {voiceOn ? <Volume2 className="size-5 text-primary" /> : <VolumeX className="size-5 text-muted-foreground" />}
          {voiceOn ? labels.speakerOn : labels.speakerOff}
        </button>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${percent}%` }} />
      </div>
    </header>
  )
}
