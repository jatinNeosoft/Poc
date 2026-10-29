import { CV_FIELDS, FIELD_BY_KEY, MAX_ATTEMPTS } from "./fields"
import { formatSalary, JOB_TYPE_LABELS } from "@/lib/jobs/format"

export function jobBlock(job) {
  return [
    `- Title: ${job.title}`,
    `- Location: ${job.location}`,
    `- Job type: ${JOB_TYPE_LABELS[job.jobType]}`,
    `- Salary: ${formatSalary(job.salaryMin, job.salaryMax)}`,
    `- Openings: ${job.openings}`,
    `- Experience required: ${job.experienceRequired || "Not specified"}`,
    `- Required skills: ${job.requiredSkills.join(", ") || "Not specified"}`,
    `- Description: ${job.description}`,
  ].join("\n")
}

/** The job's questions in asking order: admin's own first, then AI-generated (English). */
export function screeningQuestions(job) {
  return [
    ...job.customQuestions.map((text) => ({ text, source: "custom" })),
    ...job.generatedQuestions.map((text) => ({ text, source: "ai" })),
  ]
}

function formatValue(v) {
  if (Array.isArray(v)) {
    return v.map((x) => (typeof x === "object" ? [x.role, x.company, x.duration].filter(Boolean).join(" / ") : x)).join("; ")
  }
  if (typeof v === "boolean") return v ? "yes" : "no"
  return String(v)
}

// The server itself appends screening questions and the closing line after the model's reply
const SERVER_CONTINUES =
  "Do NOT ask any other question and do NOT say goodbye — the server adds what comes next right after your words."

/** The "Interview state" section for this turn (sent after the conversation). */
export function stateBlock({ interview, candidate, questions, progress, target, kind, language, sttConfidence }) {
  const lines = [`Candidate's language: ${language.name}`]
  const done = new Set(progress.done)

  const collected = CV_FIELDS.filter((f) => done.has(f.key)).map((f) => {
    const value = candidate[f.key]
    const has = value !== null && value !== undefined && !(Array.isArray(value) && value.length === 0)
    return `- ${f.key}: ${has ? formatValue(value) : "(skipped / none)"}`
  })
  if (collected.length) lines.push("Already collected:", ...collected)

  const attempt = (progress.attempts[target] ?? 0) + 1
  const attemptNote =
    attempt >= MAX_ATTEMPTS
      ? ` (attempt ${attempt} of ${MAX_ATTEMPTS} — LAST attempt: accept the best answer you have, or skip it, and move on)`
      : attempt > 1
        ? ` (attempt ${attempt} of ${MAX_ATTEMPTS})`
        : ""

  const missing = CV_FIELDS.filter((f) => !done.has(f.key))

  switch (interview.step) {
    case "GREETING":
      lines.push(
        "Step: GREETING.",
        `Greet the candidate, explain the job in two short sentences, then ask the first CV question: ${CV_FIELDS[0].ask}.`
      )
      break

    case "CV":
      lines.push(
        "Step: CV DETAILS.",
        "Fields still needed, in this order:",
        ...missing.map((f, i) => `${i + 1}. ${f.key} — ${f.ask}`),
        `Current question: ${target} — ${FIELD_BY_KEY[target]?.ask}${attemptNote}.`,
        missing[1]
          ? `If you record a usable answer, your reply must ask next about: ${missing[1].key} — ${missing[1].ask}. (Only if the candidate already answered that too, go on to the next missing field in the list.) Do not skip fields.`
          : "This is the LAST CV field. If you record a usable answer, your reply must offer the VIDEO: ask if they would like to record an optional short (30–60 second) intro video with their phone camera."
      )
      break

    case "VIDEO":
      if (interview.videoChoice === "YES") {
        lines.push(
          "Step: VIDEO. The candidate agreed to record a video and the recorder is open on their screen.",
          `If they now say they don't want to: set videoDecision "no" and reply with one short sentence that this is completely fine. ${SERVER_CONTINUES}`,
          "Otherwise gently remind them to press the record button, or the skip button if they changed their mind."
        )
      } else {
        lines.push(
          "Step: VIDEO OFFER.",
          "Ask (or you already asked) if they would like to record an optional 30–60 second intro video with their phone camera. Make clear it is optional.",
          `If yes: set videoDecision "yes" and tell them to press the record button below the chat.`,
          `If no: set videoDecision "no" and reply with one short sentence that this is completely fine. ${SERVER_CONTINUES}`
        )
      }
      break

    case "SCREENING": {
      const q = questions[interview.screeningIdx]
      if (kind === "note") {
        lines.push(
          "Step: SCREENING QUESTIONS are about to start.",
          `Reply with one short thank-you sentence and say that a few questions about the job follow. ${SERVER_CONTINUES}`
        )
      } else {
        lines.push(
          "Step: SCREENING QUESTIONS. The server asks each question itself.",
          `CURRENT question ${interview.screeningIdx + 1} of ${questions.length} — the candidate is answering THIS one now: "${q?.localized}" (English: "${q?.text}")${attemptNote}.`,
          `If the answer is usable: put a short English summary of the answer to THIS question in screeningAnswer, and reply with ONE very short natural acknowledgement only, different from your previous ones (for example "अच्छा।" / "ठीक है।" / "Okay." / "Alright."). No "thank you", and never say you noted or recorded it. ${SERVER_CONTINUES}`,
          "If it is not usable: leave screeningAnswer null and ask the CURRENT question again in simpler words."
        )
      }
      break
    }

    case "DONE":
      lines.push(`Step: FINISHED. Reply with one short, warm thank-you sentence only. ${SERVER_CONTINUES}`)
      break
  }

  if (kind === "note") {
    lines.push("The latest message is a system note, not an answer from the candidate: set answerCheck to null.")
  } else if (sttConfidence !== null && sttConfidence !== undefined) {
    const level = sttConfidence < 0.6 ? "LOW — check carefully if it was misheard" : "ok"
    lines.push(`The candidate's last answer came from speech-to-text, confidence ${sttConfidence.toFixed(2)} (${level}).`)
  }

  return lines.join("\n")
}
