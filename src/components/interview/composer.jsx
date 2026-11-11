"use client"

import { useEffect, useRef, useState } from "react"
import { Keyboard, Mic, Send, Square } from "lucide-react"
import { cn } from "@/lib/utils"
import { useSpeechRecognition } from "@/hooks/use-speech-recognition"
import { ErrorBanner } from "./error-banner"

// Hands-free: if nobody speaks after the mic opened by itself, listen again this many times
const AUTO_RETRIES = 1

// iPhone / iPad (iPadOS reports itself as a Mac with a touch screen)
function isIOS() {
  if (typeof navigator === "undefined") return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
}

/**
 * Voice-first answer box: big mic button, "type instead" as backup.
 * Hands-free: the mic opens by itself whenever autoListenKey changes (after each AI question is read)
 * and closes by itself when the candidate stops talking.
 */
export function Composer({ lang, labels, busy, error, onSend, autoListenKey, onBeforeListen, onUserGesture, onError }) {
  const [mode, setMode] = useState("voice")
  const [text, setText] = useState("")
  const [hint, setHint] = useState(null) // label key shown under the mic
  const retriesRef = useRef(0)
  const autoRef = useRef(false) // the current mic session was opened by itself (not by a tap)

  const stt = useSpeechRecognition({
    lang: lang.sttLang,
    onResult: (transcript, confidence) => {
      setHint(null)
      onSend({ text: transcript, inputMode: "voice", sttConfidence: confidence })
    },
    onError: (code) => {
      // iPhone only opens the mic from a tap: a refused hands-free start just means "tap to speak"
      if (autoRef.current && (code === "not-allowed" || code === "service-not-allowed")) {
        autoRef.current = false
        setHint(null)
        return
      }
      if (code === "not-allowed" || code === "audio-capture") {
        setHint("micBlocked")
        setMode("text")
      } else if (code === "network" || code === "service-not-allowed" || code === "language-not-supported") {
        // The browser's speech service is unavailable (e.g. Brave, some Edge setups, offline)
        setHint("sttUnavailable")
        setMode("text")
      } else if (code === "no-speech") {
        if (retriesRef.current > 0) {
          retriesRef.current--
          stt.start()
        } else {
          setHint("noSpeech")
        }
      } else {
        onError({ label: "networkError" })
      }
    },
  })

  // No speech-to-text in this browser → typing only (null = not checked yet)
  useEffect(() => {
    if (stt.supported === false) setMode("text")
  }, [stt.supported])

  // Latest values for the auto-listen effect, which should only re-run when the key changes
  const latest = useRef({})
  latest.current = { busy, mode, start: stt.start }

  useEffect(() => {
    const { busy, mode, start } = latest.current
    if (!autoListenKey || busy || mode !== "voice") return
    // iPhone/iPad only record when the mic is opened by a tap; a self-opened mic there looks
    // like it is listening but hears nothing. So on iOS: no hands-free, the candidate taps.
    if (isIOS()) return setHint(null)
    retriesRef.current = AUTO_RETRIES
    autoRef.current = true
    setHint(null)
    start()
  }, [autoListenKey])

  function toggleMic() {
    // No onUserGesture() here: playing the unlock sound right before recording can stop iPhone
    // from opening the mic. The audio player is already unlocked by the language tap.
    if (stt.listening) {
      // Words heard → this tap means "done", send the answer
      if (stt.interim) {
        retriesRef.current = 0
        stt.stop()
        return
      }
      // Nothing heard yet in a session the page opened by itself: replace it with one started by
      // this tap (iPhone may show such a session as listening while recording nothing)
      if (autoRef.current) {
        retriesRef.current = 0
        autoRef.current = false
        setHint(null)
        stt.restart()
      }
      // Nothing heard yet in a session the candidate started: keep listening (an early tap must not stop it)
      return
    }
    retriesRef.current = 0
    autoRef.current = false
    onBeforeListen()
    setHint(null)
    stt.start()
  }

  function submitText(e) {
    e.preventDefault()
    const value = text.trim()
    if (!value || busy) return
    onUserGesture?.()
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
            aria-label={stt.listening ? (stt.interim ? labels.stopRecording : labels.listening) : labels.tapToSpeak}
            className={cn(
              "flex size-24 items-center justify-center rounded-full text-white shadow-lg transition active:scale-95 disabled:opacity-40",
              stt.listening ? "animate-pulse bg-red-500" : "bg-primary"
            )}
          >
            {/* Mic while waiting for speech; a stop square once words are heard (tap = done) */}
            {stt.listening && stt.interim ? <Square className="size-9 fill-current" /> : <Mic className="size-11" />}
          </button>
          <button
            type="button"
            onClick={() => {
              retriesRef.current = 0
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
