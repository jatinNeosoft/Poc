"use client"

import { useCallback, useEffect, useRef, useState } from "react"

function getRecognitionClass() {
  if (typeof window === "undefined") return null
  return window.SpeechRecognition || window.webkitSpeechRecognition || null
}

/**
 * Browser speech-to-text (Web Speech API). One utterance per start().
 * onResult(text, confidence|null) fires once with the final text; onError(code) with
 * "not-allowed" | "no-speech" | other Web Speech error codes.
 */
export function useSpeechRecognition({ lang, onResult, onError }) {
  const [supported, setSupported] = useState(null) // null until checked in the browser
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState("")
  const recRef = useRef(null)
  const handlers = useRef({ onResult, onError })
  handlers.current = { onResult, onError }

  useEffect(() => setSupported(!!getRecognitionClass()), [])

  const stop = useCallback(() => recRef.current?.stop(), [])

  const start = useCallback(() => {
    const Recognition = getRecognitionClass()
    if (!Recognition || recRef.current) return

    const rec = new Recognition()
    rec.lang = lang
    rec.interimResults = true
    rec.continuous = false
    rec.maxAlternatives = 1

    let finalText = ""
    const confidences = []
    let errored = false

    rec.onresult = (e) => {
      let interimText = ""
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) {
          finalText += r[0].transcript
          if (r[0].confidence > 0) confidences.push(r[0].confidence) // Android often reports 0 = unknown
        } else {
          interimText += r[0].transcript
        }
      }
      setInterim((finalText + " " + interimText).trim())
    }
    rec.onerror = (e) => {
      errored = true
      if (e.error !== "aborted") handlers.current.onError?.(e.error)
    }
    rec.onend = () => {
      recRef.current = null
      setListening(false)
      setInterim("")
      const text = finalText.trim()
      if (text) {
        const conf = confidences.length ? confidences.reduce((a, b) => a + b, 0) / confidences.length : null
        handlers.current.onResult?.(text, conf)
      } else if (!errored) {
        handlers.current.onError?.("no-speech")
      }
    }

    recRef.current = rec
    setListening(true)
    try {
      rec.start()
    } catch {
      recRef.current = null
      setListening(false)
    }
  }, [lang])

  useEffect(() => () => recRef.current?.abort(), [])

  return { supported, listening, interim, start, stop }
}
