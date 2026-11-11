"use client"

import { useCallback, useEffect, useRef, useState } from "react"

// Stop listening this long after the last recognised words (hands-free end of answer)
const SILENCE_MS = 2000
// Hard limit for one answer
const MAX_LISTEN_MS = 30_000

function getRecognitionClass() {
  if (typeof window === "undefined") return null
  return window.SpeechRecognition || window.webkitSpeechRecognition || null
}

/**
 * Browser speech-to-text (Web Speech API). One utterance per start().
 * onResult(text, confidence|null) fires once with the final text; onError(code) with
 * "not-allowed" | "no-speech" | other Web Speech error codes.
 * Calling start() while a session is still closing (e.g. from onError) restarts it once it has ended.
 */
export function useSpeechRecognition({ lang, onResult, onError }) {
  const [supported, setSupported] = useState(null) // null until checked in the browser
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState("")
  const recRef = useRef(null)
  const endingRef = useRef(false) // current session got an error / stop and is about to end
  const restartRef = useRef(false) // start() was called while the session was ending
  const startRef = useRef(null)
  const handlers = useRef({ onResult, onError })
  handlers.current = { onResult, onError }

  useEffect(() => setSupported(!!getRecognitionClass()), [])

  const stop = useCallback(() => {
    restartRef.current = false
    if (recRef.current) {
      endingRef.current = true
      recRef.current.stop()
    }
  }, [])

  const start = useCallback(() => {
    const Recognition = getRecognitionClass()
    if (!Recognition) return
    if (recRef.current) {
      // A new start() while the old session is still closing: run it right after onend
      if (endingRef.current) restartRef.current = true
      return
    }

    const rec = new Recognition()
    rec.lang = lang
    rec.interimResults = true
    rec.continuous = false
    rec.maxAlternatives = 1

    let finalText = ""
    let heardText = "" // everything recognised so far, final or not
    const confidences = []
    let errored = false
    let silenceTimer = null

    // iPhone Safari often never marks results final and never ends by itself: after a pause
    // in speech, stop here; onend then sends whatever was heard.
    const endSoon = (ms) => {
      clearTimeout(silenceTimer)
      silenceTimer = setTimeout(() => {
        if (recRef.current === rec) {
          endingRef.current = true
          rec.stop()
        }
      }, ms)
    }
    const maxTimer = setTimeout(() => endSoon(0), MAX_LISTEN_MS)

    rec.onresult = (e) => {
      finalText = ""
      heardText = ""
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i]
        heardText += r[0].transcript
        if (r.isFinal) {
          finalText += r[0].transcript
          if (r[0].confidence > 0) confidences.push(r[0].confidence) // Android often reports 0 = unknown
        }
      }
      setInterim(heardText.trim())
      if (heardText.trim()) endSoon(SILENCE_MS)
    }
    rec.onerror = (e) => {
      errored = true
      endingRef.current = true
      if (e.error !== "aborted" && !(e.error === "no-speech" && heardText.trim())) {
        console.warn("[speech-to-text]", e.error)
        handlers.current.onError?.(e.error)
      }
    }
    rec.onend = () => {
      clearTimeout(silenceTimer)
      clearTimeout(maxTimer)
      recRef.current = null
      endingRef.current = false
      setListening(false)
      setInterim("")
      // Prefer the final text; fall back to what was heard (iPhone may never send a final result)
      const text = (finalText.trim() || heardText).trim()
      if (text) {
        restartRef.current = false
        const conf = confidences.length ? confidences.reduce((a, b) => a + b, 0) / confidences.length : null
        handlers.current.onResult?.(text, conf)
      } else if (!errored && !restartRef.current) {
        handlers.current.onError?.("no-speech")
      }
      if (restartRef.current) {
        restartRef.current = false
        startRef.current?.()
      }
    }

    recRef.current = rec
    endingRef.current = false
    setListening(true)
    try {
      rec.start()
    } catch {
      recRef.current = null
      setListening(false)
    }
  }, [lang])
  startRef.current = start

  /**
   * Drop the current session without waiting for it to end, and start a new one right now.
   * For taps: iPhone only records when start() runs inside the tap itself, so a session the page
   * opened by itself is replaced instead of reused.
   */
  const restart = useCallback(() => {
    const old = recRef.current
    if (old) {
      old.onresult = old.onerror = old.onend = null // its timers check recRef, so they go quiet too
      try {
        old.abort()
      } catch {}
      recRef.current = null
      endingRef.current = false
      restartRef.current = false
      setInterim("")
    }
    start()
  }, [start])

  useEffect(
    () => () => {
      restartRef.current = false
      recRef.current?.abort()
    },
    []
  )

  return { supported, listening, interim, start, stop, restart }
}
