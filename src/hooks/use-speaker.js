"use client"

import { useCallback, useEffect, useRef, useState } from "react"

// 44-byte silent WAV, played inside a tap to unlock audio on iPhone (see unlock())
const SILENT_WAV = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA="

/**
 * Pick the device voice for a language config ({ lang, preferredVoices }):
 * preferred name → any voice with the exact lang (en-IN). Never another accent of the
 * same language (no US/UK voice for en-IN): without a match the server voice is used.
 */
function pickVoice(voices, tts) {
  const norm = (l) => l?.replace("_", "-").toLowerCase()
  const lang = norm(tts.lang)
  const sameLang = voices.filter((v) => norm(v.lang) === lang)

  for (const name of tts.preferredVoices ?? []) {
    const v = sameLang.find((v) => v.name.toLowerCase().includes(name.toLowerCase()))
    if (v) return v
  }
  return sameLang[0] ?? null
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
 * speak() resolves "done" (read to the end), "stopped" (cut off by stop()) or "blocked"
 * (the browser refused to play without a tap — iPhone; blockedId is then set so the UI can offer a button).
 *
 * iPhone only plays audio started from a tap, per <audio> element. So one element is reused for the
 * whole interview and unlock() — called inside tap handlers — plays a silent clip on it.
 */
export function useSpeaker({ tts, mode = "auto", fetchServerAudio }) {
  const [speakingId, setSpeakingId] = useState(null)
  const [blockedId, setBlockedId] = useState(null)
  const voiceRef = useRef(undefined) // undefined = not looked up yet, null = none on this device
  const audioRef = useRef(null) // the one <audio> element
  const urlRef = useRef(null) // object URL of the current MP3
  const settleRef = useRef(null) // resolves the playing promise when stop() interrupts it
  const stopCountRef = useRef(0) // bumped by every stop(), so speak() can tell it was interrupted

  const getAudio = useCallback(() => {
    if (!audioRef.current) {
      const audio = new Audio()
      audio.preload = "auto"
      audio.setAttribute("playsinline", "")
      audioRef.current = audio
    }
    return audioRef.current
  }, [])

  /** Call synchronously inside a tap/click handler. */
  const unlock = useCallback(() => {
    if (typeof window === "undefined") return
    try {
      window.speechSynthesis?.speak(new SpeechSynthesisUtterance(""))
    } catch {}
    const audio = getAudio()
    if (audio.paused) {
      audio.src = SILENT_WAV
      audio.play().catch(() => {})
    }
  }, [getAudio])

  const stop = useCallback(() => {
    stopCountRef.current++
    if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel()
    audioRef.current?.pause()
    settleRef.current?.("stopped")
    settleRef.current = null
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current)
      urlRef.current = null
    }
    setSpeakingId(null)
    setBlockedId(null) // the blocked audio is gone, so hide its "tap to hear" button
  }, [])

  const playServer = useCallback(
    async (id) => {
      const blob = await fetchServerAudio(id)
      const audio = getAudio()
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
      urlRef.current = URL.createObjectURL(blob)
      audio.src = urlRef.current
      return new Promise((resolve) => {
        settleRef.current = resolve
        audio.onended = () => resolve("done")
        audio.onerror = () => resolve("done") // broken audio: carry on, the text is on screen
        audio.play().catch((err) => resolve(err?.name === "NotAllowedError" ? "blocked" : "done"))
      })
    },
    [fetchServerAudio, getAudio]
  )

  const speak = useCallback(
    async (id, text) => {
      stop()
      if (typeof window === "undefined") return "stopped"
      const myStop = stopCountRef.current
      const interrupted = () => stopCountRef.current !== myStop
      setBlockedId(null)
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
            return interrupted() ? "stopped" : "done"
          }
        }
        if (mode === "browser") return "done"
        const result = await playServer(id)
        if (result === "blocked" && !interrupted()) {
          setBlockedId(id)
          return "blocked"
        }
        return interrupted() ? "stopped" : result
      } catch {
        // Speech is a convenience: the text is always on screen
        return interrupted() ? "stopped" : "done"
      } finally {
        setSpeakingId((cur) => (cur === id ? null : cur))
      }
    },
    [mode, tts, stop, playServer]
  )

  /**
   * Play the message the browser blocked. Call synchronously inside a tap: its MP3 is already
   * loaded in the element, so play() starts within the tap and iPhone allows it (and the element
   * stays unlocked for the next messages).
   */
  const playBlocked = useCallback(() => {
    const audio = audioRef.current
    const id = blockedId
    if (!audio || !id || !urlRef.current) return Promise.resolve("stopped")
    stopCountRef.current++
    setBlockedId(null)
    setSpeakingId(id)
    return new Promise((resolve) => {
      settleRef.current = resolve
      audio.onended = () => resolve("done")
      audio.onerror = () => resolve("done")
      audio.currentTime = 0
      audio.play().catch(() => {
        setBlockedId(id)
        resolve("blocked")
      })
    }).finally(() => setSpeakingId((cur) => (cur === id ? null : cur)))
  }, [blockedId])

  useEffect(() => stop, [stop])

  return { speak, stop, unlock, playBlocked, speakingId, blockedId }
}
