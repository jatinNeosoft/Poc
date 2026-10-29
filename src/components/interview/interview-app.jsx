"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Loader2 } from "lucide-react"
import { api, clearSession, errorLabel, loadSession, saveSession } from "@/lib/interview/client"
import { useSpeaker } from "@/hooks/use-speaker"
import { LanguagePicker } from "./language-picker"
import { ChatHeader } from "./chat-header"
import { MessageList } from "./message-list"
import { Composer } from "./composer"
import { VideoRecorder } from "./video-recorder"
import { FinalScreen, ClosedScreen } from "./final-screen"

/**
 * Candidate interview: language → voice chat (→ optional video) → submitted.
 * Resumes from localStorage on the same device.
 */
export function InterviewApp({ job, languages, ttsMode }) {
  const [phase, setPhase] = useState("loading") // loading | closed | language | chat
  const [session, setSession] = useState(null)
  const [state, setState] = useState(null)
  const [langCode, setLangCode] = useState(null)
  const [starting, setStarting] = useState(null) // language code being started
  const [pending, setPending] = useState(null) // { text, inputMode, sttConfidence } while sending
  const [error, setError] = useState(null) // { label, retry? }
  const [voiceOn, setVoiceOn] = useState(true)
  const [listenAfter, setListenAfter] = useState(null) // AI message id: open the mic by itself once it's been read
  const lastSpokenRef = useRef(null)

  const lang = languages.find((l) => l.code === langCode) ?? null
  const labels = lang?.labels ?? languages[0].labels

  const fetchServerAudio = useCallback(
    async (messageId) => {
      const res = await fetch(`/api/interview/${session.interviewId}/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-resume-token": session.resumeToken },
        body: JSON.stringify({ messageId }),
      })
      if (!res.ok) throw new Error("tts failed")
      return res.blob()
    },
    [session]
  )

  const speaker = useSpeaker({ tts: lang?.tts ?? languages[0].tts, mode: ttsMode, fetchServerAudio })

  // Resume a saved interview, else show the language picker (or "closed")
  useEffect(() => {
    const saved = loadSession(job.slug)
    if (!saved) {
      setPhase(job.closed ? "closed" : "language")
      return
    }
    api(`/api/interview/${saved.interviewId}`, { token: saved.resumeToken })
      .then(({ state }) => {
        setSession(saved)
        setLangCode(state.language)
        lastSpokenRef.current = state.messages.at(-1)?.id // don't auto-play old messages on reload
        setState(state)
        setPhase("chat")
      })
      .catch(() => {
        clearSession(job.slug)
        setPhase(job.closed ? "closed" : "language")
      })
  }, [job.slug, job.closed])

  // Read each new AI message aloud, then start listening for the answer (hands-free).
  // Not if the speech was cut off (mic tapped, replay…), so the mic never hears the AI's own voice.
  useEffect(() => {
    const last = state?.messages.at(-1)
    if (!last || last.role !== "assistant" || last.id === lastSpokenRef.current) return
    lastSpokenRef.current = last.id
    if (!voiceOn) return setListenAfter(last.id)
    speaker.speak(last.id, last.content).then((finished) => finished && setListenAfter(last.id))
  }, [state, voiceOn, speaker])

  async function start(code) {
    // This tap unlocks audio on mobile browsers for the rest of the session
    try {
      window.speechSynthesis?.speak(new SpeechSynthesisUtterance(""))
    } catch {}
    setLangCode(code)
    setStarting(code)
    setError(null)
    try {
      const data = await api("/api/interview/start", { body: { slug: job.slug, language: code } })
      const s = { interviewId: data.state.interviewId, resumeToken: data.resumeToken }
      saveSession(job.slug, s)
      setSession(s)
      setState(data.state)
      setPhase("chat")
    } catch (e) {
      if (e.code === "job_closed") setPhase("closed")
      else setError({ label: errorLabel(e.code) })
    } finally {
      setStarting(null)
    }
  }

  async function send(input) {
    speaker.stop()
    setPending(input)
    setError(null)
    try {
      const data = await api(`/api/interview/${session.interviewId}/message`, {
        token: session.resumeToken,
        body: input,
      })
      setState(data.state)
      setPending(null)
    } catch (e) {
      if (e.code === "finished") {
        const { state } = await api(`/api/interview/${session.interviewId}`, { token: session.resumeToken })
        setState(state)
        setPending(null)
        return
      }
      setError({ label: errorLabel(e.code), retry: () => send(input) })
    }
  }

  async function skipVideo() {
    speaker.stop()
    try {
      const data = await api(`/api/interview/${session.interviewId}/message`, {
        token: session.resumeToken,
        body: { event: "video_skipped" },
      })
      setState(data.state)
    } catch (e) {
      setError({ label: errorLabel(e.code), retry: skipVideo })
    }
  }

  function toggleVoice() {
    if (voiceOn) speaker.stop()
    setVoiceOn(!voiceOn)
  }

  if (phase === "loading") {
    return (
      <main className="flex min-h-svh items-center justify-center">
        <Loader2 className="size-10 animate-spin text-muted-foreground" />
      </main>
    )
  }

  if (phase === "closed") return <ClosedScreen job={job} languages={languages} />

  if (phase === "language") {
    return <LanguagePicker job={job} languages={languages} onPick={start} starting={starting} error={error} />
  }

  const finished = state.ui === "done" || state.ui === "duplicate"

  return (
    <main className="mx-auto flex h-svh max-w-lg flex-col bg-background">
      <ChatHeader
        title={job.title}
        percent={state.percent}
        voiceOn={voiceOn}
        onToggleVoice={toggleVoice}
        labels={labels}
      />

      <MessageList
        messages={state.messages}
        pending={pending}
        speakingId={speaker.speakingId}
        onReplay={(m) => speaker.speak(m.id, m.content)}
        labels={labels}
        thinking={!!pending && !error}
        footerKey={state.ui}
      />

      {finished ? (
        <FinalScreen duplicate={state.ui === "duplicate"} labels={labels} />
      ) : state.ui === "video" ? (
        <VideoRecorder
          session={session}
          labels={labels}
          error={error}
          onDone={(s) => (setError(null), setState(s))}
          onSkip={skipVideo}
          onError={setError}
        />
      ) : (
        <Composer
          lang={lang}
          labels={labels}
          busy={!!pending && !error}
          error={error}
          onSend={send}
          autoListenKey={listenAfter}
          onBeforeListen={speaker.stop}
          onError={setError}
        />
      )}
    </main>
  )
}
