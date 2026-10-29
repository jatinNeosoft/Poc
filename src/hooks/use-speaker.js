"use client"

import { useCallback, useEffect, useRef, useState } from "react"

/**
 * Pick the device voice for a language config ({ lang, preferredVoices }):
 * preferred name → exact lang (hi-IN) → same language (hi). Never a different language.
 */
function pickVoice(voices, tts) {
  const norm = (l) => l?.replace("_", "-").toLowerCase()
  const lang = norm(tts.lang)
  const prefix = lang.split("-")[0]
  const sameLang = voices.filter((v) => norm(v.lang)?.split("-")[0] === prefix)

  for (const name of tts.preferredVoices ?? []) {
    const v = sameLang.find((v) => v.name.toLowerCase().includes(name.toLowerCase()))
    if (v) return v
  }
  return sameLang.find((v) => norm(v.lang) === lang) ?? sameLang[0] ?? null
}

function loadVoices() {
  const synth = window.speechSynthesis
  const now = synth.getVoices()
  if (now.length) return Promise.resolve(now)
  // Chrome loads voices async; give up after 1.5 s (some phones have none)
  return new Promise((resolve) => {
    const done = () => resolve(synth.getVoices())
    synth.addEventListener("voiceschanged", done, { once: true })
    setTimeout(done, 1500)
  })
}

/**
 * Reads AI messages aloud in the interview language.
 * mode: "browser" (device voice only), "server" (always server MP3), "auto" (device voice, server if none).
 * fetchServerAudio(messageId) → Promise<Blob> for the server fallback.
 */
export function useSpeaker({ tts, mode = "auto", fetchServerAudio }) {
  const [speakingId, setSpeakingId] = useState(null)
  const voiceRef = useRef(undefined) // undefined = not looked up yet, null = none on this device
  const audioRef = useRef(null)

  const stop = useCallback(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel()
    if (audioRef.current) {
      audioRef.current.pause()
      URL.revokeObjectURL(audioRef.current.src)
      audioRef.current = null
    }
    setSpeakingId(null)
  }, [])

  const playServer = useCallback(
    async (id) => {
      const blob = await fetchServerAudio(id)
      const audio = new Audio(URL.createObjectURL(blob))
      audioRef.current = audio
      await new Promise((resolve) => {
        audio.onended = resolve
        audio.onerror = resolve
        audio.play().catch(resolve)
      })
    },
    [fetchServerAudio]
  )

  const speak = useCallback(
    async (id, text) => {
      stop()
      if (typeof window === "undefined") return
      setSpeakingId(id)
      try {
        const synth = window.speechSynthesis
        if (mode !== "server" && synth) {
          if (voiceRef.current === undefined) voiceRef.current = pickVoice(await loadVoices(), tts)
          const voice = voiceRef.current
          if (voice) {
            await new Promise((resolve) => {
              const u = new SpeechSynthesisUtterance(text)
              u.voice = voice
              u.lang = voice.lang
              u.rate = tts.rate ?? 1
              u.onend = resolve
              u.onerror = resolve
              synth.speak(u)
            })
            return
          }
        }
        if (mode !== "browser") await playServer(id)
      } catch {
        // Speech is a convenience: the text is always on screen
      } finally {
        setSpeakingId((cur) => (cur === id ? null : cur))
      }
    },
    [mode, tts, stop, playServer]
  )

  useEffect(() => stop, [stop])

  return { speak, stop, speakingId }
}
