"use client"

import { useEffect, useState } from "react"
import { Keyboard, Mic, Send, Square } from "lucide-react"
import { cn } from "@/lib/utils"
import { useSpeechRecognition } from "@/hooks/use-speech-recognition"
import { ErrorBanner } from "./error-banner"

/** Voice-first answer box: big mic button, "type instead" as backup. */
export function Composer({ lang, labels, busy, error, onSend, onBeforeListen, onError }) {
  const [mode, setMode] = useState("voice")
  const [text, setText] = useState("")
  const [hint, setHint] = useState(null) // label key shown under the mic

  const stt = useSpeechRecognition({
    lang: lang.sttLang,
    onResult: (transcript, confidence) => {
      setHint(null)
      onSend({ text: transcript, inputMode: "voice", sttConfidence: confidence })
    },
    onError: (code) => {
      if (code === "not-allowed" || code === "service-not-allowed" || code === "audio-capture") {
        setHint("micBlocked")
        setMode("text")
      } else if (code === "no-speech") {
        setHint("noSpeech")
      } else {
        onError({ label: "networkError" })
      }
    },
  })

  // No speech-to-text in this browser → typing only (null = not checked yet)
  useEffect(() => {
    if (stt.supported === false) setMode("text")
  }, [stt.supported])

  function toggleMic() {
    if (stt.listening) return stt.stop()
    onBeforeListen()
    setHint(null)
    stt.start()
  }

  function submitText(e) {
    e.preventDefault()
    const value = text.trim()
    if (!value || busy) return
    onSend({ text: value, inputMode: "text", sttConfidence: null })
    setText("")
  }

  return (
    <div className="shrink-0 border-t bg-background px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <ErrorBanner error={error} labels={labels} />

      {mode === "voice" ? (
        <div className="flex flex-col items-center gap-2">
          <p className="min-h-7 px-2 text-center text-lg text-muted-foreground">
            {stt.listening ? stt.interim || labels.listening : hint ? labels[hint] : busy ? labels.thinking : labels.tapToSpeak}
          </p>
          <button
            type="button"
            onClick={toggleMic}
            disabled={busy}
            aria-label={stt.listening ? labels.listening : labels.tapToSpeak}
            className={cn(
              "flex size-24 items-center justify-center rounded-full text-white shadow-lg transition active:scale-95 disabled:opacity-40",
              stt.listening ? "animate-pulse bg-red-500" : "bg-primary"
            )}
          >
            {stt.listening ? <Square className="size-9 fill-current" /> : <Mic className="size-11" />}
          </button>
          <button
            type="button"
            onClick={() => {
              stt.stop()
              setMode("text")
            }}
            className="flex h-11 items-center gap-2 px-3 text-base font-medium text-primary underline-offset-4 active:underline"
          >
            <Keyboard className="size-5" />
            {labels.typeInstead}
          </button>
        </div>
      ) : (
        <form onSubmit={submitText} className="space-y-2">
          {hint && <p className="text-center text-base text-muted-foreground">{labels[hint]}</p>}
          <div className="flex items-end gap-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) submitText(e)
              }}
              rows={2}
              maxLength={1000}
              placeholder={labels.typePlaceholder}
              aria-label={labels.typePlaceholder}
              className="min-h-14 flex-1 resize-none rounded-2xl border-2 bg-background px-4 py-3 text-lg outline-none focus:border-primary"
            />
            <button
              type="submit"
              disabled={busy || !text.trim()}
              aria-label={labels.send}
              className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
            >
              <Send className="size-6" />
            </button>
          </div>
          {stt.supported && (
            <button
              type="button"
              onClick={() => {
                setHint(null)
                setMode("voice")
              }}
              className="mx-auto flex h-11 items-center gap-2 px-3 text-base font-medium text-primary"
            >
              <Mic className="size-5" />
              {labels.speakInstead}
            </button>
          )}
        </form>
      )}
    </div>
  )
}
