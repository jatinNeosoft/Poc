"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2, RotateCcw, Send, Square, Video, X } from "lucide-react"
import { api, errorLabel } from "@/lib/interview/client"
import { ErrorBanner } from "./error-banner"

const MAX_SEC = 60
const MIN_SEC = 5

function pickMimeType() {
  if (typeof MediaRecorder === "undefined") return null
  const types = ["video/webm;codecs=vp8,opus", "video/webm", "video/mp4"]
  return types.find((t) => MediaRecorder.isTypeSupported(t)) ?? ""
}

/** Optional 30–60 s intro video with the front camera: record → review → send, or skip. */
export function VideoRecorder({ session, labels, error, onDone, onSkip, onError }) {
  const [status, setStatus] = useState("idle") // idle | starting | recording | review | uploading | failed
  const [seconds, setSeconds] = useState(0)
  const [recorded, setRecorded] = useState(null) // { blob, url, type, durationSec }

  const liveRef = useRef(null)
  const streamRef = useRef(null)
  const recorderRef = useRef(null)
  const timerRef = useRef(null)
  const startedAtRef = useRef(0)

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  useEffect(
    () => () => {
      clearInterval(timerRef.current)
      stopStream()
    },
    []
  )

  async function startRecording() {
    setStatus("starting")
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: true,
      })
      streamRef.current = stream
      liveRef.current.srcObject = stream
      await liveRef.current.play().catch(() => {})

      const mimeType = pickMimeType()
      const recorder = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), videoBitsPerSecond: 800_000 })
      const chunks = []
      recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data)
      recorder.onstop = () => {
        clearInterval(timerRef.current)
        stopStream()
        const type = (recorder.mimeType || mimeType || "video/webm").split(";")[0]
        const blob = new Blob(chunks, { type })
        const durationSec = Math.round((Date.now() - startedAtRef.current) / 1000)
        setRecorded({ blob, url: URL.createObjectURL(blob), type, durationSec })
        setStatus("review")
      }

      recorderRef.current = recorder
      recorder.start(1000)
      startedAtRef.current = Date.now()
      setSeconds(0)
      setStatus("recording")
      timerRef.current = setInterval(() => {
        const s = Math.floor((Date.now() - startedAtRef.current) / 1000)
        setSeconds(s)
        if (s >= MAX_SEC && recorder.state === "recording") recorder.stop()
      }, 250)
    } catch {
      stopStream()
      setStatus("failed")
    }
  }

  function retake() {
    if (recorded) URL.revokeObjectURL(recorded.url)
    setRecorded(null)
    startRecording()
  }

  async function upload() {
    onError(null)
    setStatus("uploading")
    const form = new FormData()
    const ext = recorded.type === "video/mp4" ? "mp4" : "webm"
    form.append("video", recorded.blob, `intro.${ext}`)
    form.append("durationSec", String(recorded.durationSec))
    try {
      const data = await api(`/api/interview/${session.interviewId}/video`, { token: session.resumeToken, formData: form })
      URL.revokeObjectURL(recorded.url)
      onDone(data.state)
    } catch (e) {
      setStatus("review")
      onError({ label: errorLabel(e.code), retry: upload })
    }
  }

  const bigButton =
    "flex h-16 w-full items-center justify-center gap-2 rounded-2xl text-xl font-bold transition active:scale-[0.98] disabled:opacity-50"

  return (
    <div className="shrink-0 space-y-3 border-t bg-background px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <ErrorBanner error={error} labels={labels} />
      <div className="relative mx-auto aspect-[3/4] max-h-[42svh] overflow-hidden rounded-2xl bg-black">
        {status === "review" && recorded ? (
          <video src={recorded.url} controls playsInline className="size-full object-cover" />
        ) : (
          <video ref={liveRef} muted playsInline className="size-full -scale-x-100 object-cover" />
        )}
        {status === "idle" && (
          <div className="absolute inset-0 flex items-center justify-center text-white/70">
            <Video className="size-16" />
          </div>
        )}
        {status === "recording" && (
          <div className="absolute top-3 left-3 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-lg font-semibold text-white tabular-nums">
            <span className="size-3 animate-pulse rounded-full bg-red-500" />
            {seconds}s / {MAX_SEC}s
          </div>
        )}
      </div>

      {status === "failed" && <p className="text-center text-lg text-destructive">{labels.cameraError}</p>}

      {(status === "idle" || status === "starting" || status === "failed") && (
        <button
          type="button"
          onClick={startRecording}
          disabled={status === "starting"}
          className={`${bigButton} bg-red-500 text-white`}
        >
          {status === "starting" ? <Loader2 className="size-6 animate-spin" /> : <Video className="size-6" />}
          {labels.startRecording}
        </button>
      )}

      {status === "recording" && (
        <button
          type="button"
          onClick={() => recorderRef.current?.stop()}
          disabled={seconds < MIN_SEC}
          className={`${bigButton} bg-foreground text-background`}
        >
          <Square className="size-6 fill-current" />
          {labels.stopRecording}
        </button>
      )}

      {(status === "review" || status === "uploading") && (
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={retake} disabled={status === "uploading"} className={`${bigButton} border-2`}>
            <RotateCcw className="size-6" />
            {labels.retake}
          </button>
          <button
            type="button"
            onClick={upload}
            disabled={status === "uploading"}
            className={`${bigButton} bg-emerald-600 text-white`}
          >
            {status === "uploading" ? <Loader2 className="size-6 animate-spin" /> : <Send className="size-6" />}
            {status === "uploading" ? labels.uploading : labels.useVideo}
          </button>
        </div>
      )}

      {status !== "uploading" && status !== "recording" && (
        <button
          type="button"
          onClick={() => {
            stopStream()
            onSkip()
          }}
          className="mx-auto flex h-11 items-center gap-1.5 px-4 text-lg font-medium text-muted-foreground"
        >
          <X className="size-5" />
          {labels.skipVideo}
        </button>
      )}
    </div>
  )
}
