"use client"

import { useEffect, useRef } from "react"
import { Volume2 } from "lucide-react"
import { cn } from "@/lib/utils"

export function MessageList({ messages, pending, speakingId, onReplay, labels, thinking, footerKey }) {
  const endRef = useRef(null)

  // Also re-scroll when the footer changes (composer → recorder / final panel) and resizes the list
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages.length, pending, thinking, footerKey])

  return (
    <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5" aria-live="polite">
      {messages.map((m) =>
        m.role === "assistant" ? (
          <div key={m.id} className="flex items-end gap-2">
            <div
              className={cn(
                "max-w-[85%] rounded-3xl rounded-bl-md bg-muted px-4 py-3 text-lg leading-relaxed",
                speakingId === m.id && "ring-2 ring-primary/40"
              )}
            >
              {m.content}
            </div>
            <button
              type="button"
              onClick={() => onReplay(m)}
              aria-label={labels.replay}
              className="mb-1 flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground active:bg-muted"
            >
              <Volume2 className={cn("size-5", speakingId === m.id && "animate-pulse text-primary")} />
            </button>
          </div>
        ) : (
          <div key={m.id} className="flex justify-end">
            <div className="max-w-[85%] rounded-3xl rounded-br-md bg-primary px-4 py-3 text-lg leading-relaxed text-primary-foreground">
              {m.content}
            </div>
          </div>
        )
      )}

      {pending && (
        <div className="flex justify-end">
          <div className="max-w-[85%] rounded-3xl rounded-br-md bg-primary/70 px-4 py-3 text-lg leading-relaxed text-primary-foreground">
            {pending.text}
          </div>
        </div>
      )}

      {thinking && (
        <div className="flex items-center gap-2 text-muted-foreground" role="status">
          <span className="flex gap-1">
            <span className="size-2.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
            <span className="size-2.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
            <span className="size-2.5 animate-bounce rounded-full bg-current" />
          </span>
          <span className="text-base">{labels.thinking}</span>
        </div>
      )}
      <div ref={endRef} />
    </div>
  )
}
