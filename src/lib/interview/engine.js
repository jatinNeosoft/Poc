import { randomBytes, timingSafeEqual } from "node:crypto"
import { prisma } from "@/lib/prisma"
import { generateStructured } from "@/lib/ai"
import { resolveAI } from "@/lib/ai/models"
import { getAISettings } from "@/lib/settings"
import { loadPrompt } from "@/lib/prompts"
import { getLanguage } from "@/lib/languages"
import { CV_FIELD_KEYS, FIELD_BY_KEY, MAX_ATTEMPTS } from "./fields"
import { TranslationSchema, TurnSchema } from "./schema"
import { checkCvValue, REASK_FIELDS } from "./rules"
import { jobBlock, screeningQuestions, stateBlock } from "./prompt"

// Fields the model may mark as "none / not applicable" even when it is not the current question
// (e.g. "I never worked" also answers previousJobs). Gender is NOT here: it must be asked, then may be skipped.
const SKIPPABLE = new Set(["willingToRelocate", "previousJobs", "certifications", "currentSalary"])

export class InterviewError extends Error {
  /** @param {"not_found"|"job_closed"|"bad_language"|"finished"|"bad_state"} code */
  constructor(code, message = code) {
    super(message)
    this.name = "InterviewError"
    this.code = code
  }
}

/**
 * progress JSON: done/attempts/flagged per question, plus
 * questions = screening questions snapshot [{ text, source, localized }] (fixed once screening is near),
 * askedIdx = index of the last screening question the server has asked.
 */
function readProgress(interview) {
  const p = interview.progress ?? {}
  return {
    done: p.done ?? [],
    attempts: p.attempts ?? {},
    flagged: p.flagged ?? [],
    questions: p.questions ?? null,
    askedIdx: p.askedIdx ?? (interview.step === "SCREENING" ? interview.screeningIdx : -1),
  }
}

/** Screening questions for this interview: the stored snapshot, else the job's current list. */
function questionsFor(interview, progress) {
  return progress.questions ?? screeningQuestions(interview.job).map((q) => ({ ...q, localized: q.text }))
}

/**
 * Freeze the screening questions for this interview and translate them once into its language,
 * so the server can ask them word-for-word (the model only acknowledges answers).
 */
async function ensureQuestions(interview, progress, language) {
  if (progress.questions) return progress.questions

  const base = screeningQuestions(interview.job)
  let localized = base.map((q) => q.text)
  if (base.length && language.code !== "en") {
    try {
      const prompt = await loadPrompt(language.code, "translate-questions", {
        languageName: language.name,
        questions: base.map((q, i) => `${i + 1}. ${q.text}`).join("\n"),
      })
      const { data } = await generateStructured({
        provider: interview.provider,
        model: interview.model,
        purpose: "TRANSLATION",
        interviewId: interview.id,
        jobId: interview.jobId,
        system: prompt,
        messages: [{ role: "user", content: "Translate the questions." }],
        schema: TranslationSchema,
        schemaName: "translations",
        maxTokens: 2000,
      })
      if (data.translations.length === base.length) localized = data.translations.map((t) => t.trim())
    } catch (err) {
      console.error("[interview] question translation failed, using English", err)
    }
  }

  const questions = base.map((q, i) => ({ ...q, localized: localized[i] || q.text }))
  progress.questions = questions
  await prisma.interview.update({ where: { id: interview.id }, data: { progress } })
  return questions
}

const joinReply = (a, b) => [a.trim(), b.trim()].filter(Boolean).join(" ")

/** What the candidate is being asked right now: a CV field key, "video", "screening:<i>", or null. */
function currentTarget(interview, progress) {
  switch (interview.step) {
    case "CV":
      return CV_FIELD_KEYS.find((k) => !progress.done.includes(k)) ?? null
    case "VIDEO":
      return "video"
    case "SCREENING":
      return `screening:${interview.screeningIdx}`
    default:
      return null
  }
}

function questionText(target, questions) {
  if (!target) return ""
  if (target === "video") return "Optional intro video"
  if (target.startsWith("screening:")) return questions[Number(target.split(":")[1])]?.text ?? ""
  return FIELD_BY_KEY[target]?.ask ?? target
}

// Notes (system events) are sent to the model as bracketed user messages
function toModelMessage(m) {
  if (m.role === "ASSISTANT") return { role: "assistant", content: m.content }
  if (m.role === "SYSTEM") return { role: "user", content: `[Note: ${m.content}]` }
  return { role: "user", content: m.content }
}

function todayText() {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "full", timeZone: "Asia/Kolkata" }).format(new Date())
}

export function newResumeToken() {
  return randomBytes(24).toString("base64url")
}

/** Interview for an id + resume token, or null. Constant-time token compare. */
export async function findInterviewForToken(id, token) {
  if (!id || !token) return null
  const interview = await prisma.interview.findUnique({ where: { id } })
  if (!interview) return null
  const a = Buffer.from(interview.resumeToken)
  const b = Buffer.from(String(token))
  return a.length === b.length && timingSafeEqual(a, b) ? interview : null
}

/** Create candidate + interview and get the AI greeting. */
export async function startInterview({ slug, languageCode }) {
  const job = await prisma.job.findUnique({ where: { slug } })
  if (!job) throw new InterviewError("not_found")
  if (job.status !== "OPEN") throw new InterviewError("job_closed")
  const language = getLanguage(languageCode)
  if (!language) throw new InterviewError("bad_language")

  const { provider, model } = resolveAI(job, await getAISettings())
  const candidate = await prisma.candidate.create({
    data: {
      jobId: job.id,
      interview: {
        create: { jobId: job.id, language: language.code, provider, model, resumeToken: newResumeToken() },
      },
    },
    include: { interview: true },
  })

  const { interview } = candidate
  await runTurn(interview.id, {
    kind: "note",
    text: `The candidate opened the interview link and chose ${language.name}. Start the interview.`,
  })
  return { interviewId: interview.id, resumeToken: interview.resumeToken }
}

/** Video recorded+uploaded or skipped from the recorder screen. */
export async function videoEvent(interviewId, event) {
  const interview = await prisma.interview.findUnique({ where: { id: interviewId }, include: { job: true } })
  if (!interview || interview.status !== "IN_PROGRESS") throw new InterviewError("finished")
  if (interview.step !== "VIDEO") throw new InterviewError("bad_state", "Not at the video step")

  if (event === "uploaded") {
    const video = await prisma.video.findUnique({ where: { candidateId: interview.candidateId } })
    if (!video) throw new InterviewError("bad_state", "No video uploaded")
  }

  const progress = readProgress(interview)
  const hasQuestions = questionsFor(interview, progress).length > 0
  await prisma.interview.update({
    where: { id: interviewId },
    data: {
      videoChoice: event === "uploaded" ? "YES" : "NO",
      step: hasQuestions ? "SCREENING" : "DONE",
      progress: { ...progress, done: [...new Set([...progress.done, "video"])] },
    },
  })

  return runTurn(interviewId, {
    kind: "note",
    text:
      event === "uploaded"
        ? "The candidate recorded and sent the intro video. Thank them and continue."
        : "The candidate chose not to record a video. Say that is completely fine and continue.",
  })
}

/**
 * One interview turn: send the candidate's answer (or a system note) to the AI,
 * apply the checks + extracted fields, advance the step, save everything.
 * @param {string} interviewId
 * @param {{kind: "answer", text: string, inputMode: "voice"|"text", sttConfidence?: number|null} | {kind: "note", text: string}} input
 */
export async function runTurn(interviewId, input) {
  const interview = await prisma.interview.findUnique({
    where: { id: interviewId },
    include: { candidate: true, job: true, messages: { orderBy: { createdAt: "asc" } } },
  })
  if (!interview) throw new InterviewError("not_found")
  if (interview.status !== "IN_PROGRESS") throw new InterviewError("finished")

  const { job, candidate } = interview
  const language = getLanguage(interview.language)
  const progress = readProgress(interview)
  const target = currentTarget(interview, progress)
  const questions = ["VIDEO", "SCREENING"].includes(interview.step)
    ? await ensureQuestions(interview, progress, language)
    : questionsFor(interview, progress)

  // System prompt stays identical for the whole interview (cacheable); the state goes in turnContext
  const system = await loadPrompt(interview.language, "system", { jobBlock: jobBlock(job), today: todayText() })
  const turnContext = `Interview state for this turn (from the server, not the candidate):\n${stateBlock({
    interview,
    candidate,
    questions,
    progress,
    target,
    kind: input.kind,
    language,
    sttConfidence: input.kind === "answer" && input.inputMode === "voice" ? (input.sttConfidence ?? null) : null,
  })}`

  const incoming = { role: input.kind === "note" ? "SYSTEM" : "USER", content: input.text.trim() }
  const { data, usage } = await generateStructured({
    provider: interview.provider,
    model: interview.model,
    purpose: "INTERVIEW_TURN",
    interviewId,
    jobId: job.id,
    system,
    turnContext,
    messages: [...interview.messages, incoming].map(toModelMessage),
    schema: TurnSchema,
    schemaName: "interview_turn",
    maxTokens: 4000,
  })

  return applyTurn({ interview, language, progress, questions, target, input, incoming, data, usage })
}

async function applyTurn({ interview, language, progress, questions, target, input, incoming, data, usage }) {
  const { job, candidate } = interview
  const done = new Set(progress.done)
  const flagged = new Set(progress.flagged)
  const attempts = { ...progress.attempts }

  let { step, status, videoChoice, screeningIdx } = interview
  let reply = data.reply.trim()

  // 1. Answer check + attempt counting (only real answers to a known question)
  const check = input.kind === "answer" && target && data.answerCheck ? { ...data.answerCheck } : null
  let poor = false
  let lastAttempt = false
  let flagTarget = false
  if (check) {
    attempts[target] = (attempts[target] ?? 0) + 1
    poor = check.quality === "POOR"
    lastAttempt = attempts[target] >= MAX_ATTEMPTS
    flagTarget = poor && lastAttempt
  }

  // 2. CV values: model output → hard rules → save
  const cvData = {}
  let reaskKey = null
  for (const key of CV_FIELD_KEYS) {
    const raw = data.cvUpdates?.[key]
    if (raw === null || raw === undefined) continue
    if (key === target && poor && !lastAttempt) continue // model itself was not sure yet
    const res = checkCvValue(key, raw)
    if (res.ok) {
      cvData[key] = res.value
      done.add(key)
    } else if (key === target && REASK_FIELDS.has(key) && !lastAttempt) {
      reaskKey = key
    }
  }
  for (const key of data.skippedFields ?? []) {
    if (FIELD_BY_KEY[key] && (key === target || SKIPPABLE.has(key)) && !(key in cvData)) done.add(key)
  }
  if (reaskKey) {
    reply = language.labels.reask[reaskKey]
    if (check) Object.assign(check, { valid: false, quality: "POOR" })
  }
  if (flagTarget && FIELD_BY_KEY[target]) {
    done.add(target)
    flagged.add(target)
  }

  // 3. Duplicate application check (same job + phone)
  let releaseCandidateId = null
  if (cvData.phone) {
    const other = await prisma.candidate.findFirst({
      where: { jobId: job.id, phone: cvData.phone, id: { not: candidate.id } },
      include: { interview: true },
    })
    if (other?.interview?.status === "IN_PROGRESS") {
      releaseCandidateId = other.id // same person restarted on another device: keep the newer interview
    } else if (other) {
      delete cvData.phone
      status = "DUPLICATE"
      step = "DONE"
      reply = language.labels.alreadyApplied
    }
  }

  // 4. Advance the step
  let screeningCreate = null
  if (status === "IN_PROGRESS") {
    if (step === "GREETING") step = "CV"

    if (interview.step === "VIDEO" && input.kind === "answer") {
      const decision = flagTarget ? "no" : data.videoDecision
      if (decision === "yes") videoChoice = "YES"
      if (decision === "no") {
        videoChoice = "NO"
        done.add("video")
        step = questions.length ? "SCREENING" : "DONE"
      }
    }

    if (interview.step === "SCREENING" && input.kind === "answer") {
      const usable = check ? !poor || lastAttempt : !!data.screeningAnswer
      const q = questions[screeningIdx]
      if (usable && q) {
        screeningCreate = {
          candidateId: candidate.id,
          question: q.text,
          answer: (data.screeningAnswer?.trim() || input.text.trim()).slice(0, 500),
          source: q.source,
          order: screeningIdx,
          quality: check?.quality ?? null,
          fit: check?.fit ?? null,
          fitReason: check?.fitReason ?? null,
          flagged: flagTarget,
        }
        screeningIdx += 1
        if (screeningIdx >= questions.length) step = "DONE"
      }
    }

    if (step === "CV" && CV_FIELD_KEYS.every((k) => done.has(k))) step = "VIDEO"
    if (step === "DONE") status = "COMPLETED"
  }

  // 5. The server asks screening questions word-for-word and adds the closing line itself,
  //    so answers can never be stored under the wrong question
  let askedIdx = progress.askedIdx
  if (status === "IN_PROGRESS" && step === "SCREENING" && askedIdx < screeningIdx && questions[screeningIdx]) {
    reply = joinReply(reply, questions[screeningIdx].localized)
    askedIdx = screeningIdx
  }
  if (status === "COMPLETED") reply = joinReply(reply, language.labels.submitted)

  // 6. Save everything at once
  await prisma.$transaction(async (tx) => {
    if (releaseCandidateId) {
      await tx.candidate.update({ where: { id: releaseCandidateId }, data: { phone: null } })
      await tx.interview.update({
        where: { candidateId: releaseCandidateId },
        data: { status: "ABANDONED", endedAt: new Date() },
      })
    }

    const userMsg = await tx.message.create({ data: { interviewId: interview.id, ...incoming } })

    if (check) {
      await tx.answerCheck.create({
        data: {
          interviewId: interview.id,
          messageId: userMsg.id,
          target,
          question: questionText(target, questions),
          answer: input.text.trim().slice(0, 1000),
          inputMode: input.inputMode,
          sttConfidence: input.sttConfidence ?? null,
          relevant: check.relevant,
          clear: check.clear,
          valid: check.valid,
          misheard: check.misheard,
          quality: check.quality,
          fit: check.fit,
          fitReason: check.fitReason,
          attempt: attempts[target],
          flagged: flagTarget,
        },
      })
    }

    if (screeningCreate) await tx.screeningAnswer.create({ data: screeningCreate })

    await tx.candidate.update({
      where: { id: candidate.id },
      data: { ...cvData, ...(flagTarget ? { flaggedCount: { increment: 1 } } : {}) },
    })

    await tx.message.create({
      data: {
        interviewId: interview.id,
        role: "ASSISTANT",
        content: reply,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
      },
    })

    await tx.interview.update({
      where: { id: interview.id },
      data: {
        step,
        status,
        videoChoice,
        screeningIdx,
        progress: { done: [...done], attempts, flagged: [...flagged], questions: progress.questions, askedIdx },
        ...(status !== "IN_PROGRESS" ? { endedAt: new Date() } : {}),
      },
    })
  })

  return { completed: status === "COMPLETED", status }
}

/** Interview state for the candidate's browser (no internal notes, no scores). */
export async function getClientState(interviewId) {
  const interview = await prisma.interview.findUnique({
    where: { id: interviewId },
    include: {
      job: true,
      candidate: { include: { video: { select: { id: true } } } },
      messages: { where: { role: { not: "SYSTEM" } }, orderBy: { createdAt: "asc" } },
    },
  })
  if (!interview) return null

  const progress = readProgress(interview)
  const totalQuestions = questionsFor(interview, progress).length
  const cvDone = CV_FIELD_KEYS.filter((k) => progress.done.includes(k)).length
  const videoDone = progress.done.includes("video")
  const percent =
    interview.status === "COMPLETED"
      ? 100
      : Math.round(
          (cvDone / CV_FIELD_KEYS.length) * 70 +
            (videoDone ? 10 : 0) +
            (totalQuestions ? (interview.screeningIdx / totalQuestions) * 20 : videoDone ? 20 : 0)
        )

  let ui = null
  if (interview.status === "DUPLICATE") ui = "duplicate"
  else if (interview.status === "COMPLETED") ui = "done"
  else if (interview.step === "VIDEO" && interview.videoChoice === "YES") ui = "video"

  return {
    interviewId: interview.id,
    status: interview.status,
    step: interview.step,
    language: interview.language,
    ui,
    hasVideo: !!interview.candidate.video,
    percent,
    messages: interview.messages.map((m) => ({
      id: m.id,
      role: m.role === "USER" ? "user" : "assistant",
      content: m.content,
    })),
  }
}
