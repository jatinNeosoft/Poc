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

/** Questions in the order they are asked: admin's own first, then AI-generated. */
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

function afterVideoInstruction(questions, idx = 0) {
  return questions[idx]
    ? `then ask the first screening question: "${questions[idx].text}"`
    : "then thank them and tell them clearly that their application is submitted. Say goodbye."
}

/** The "Interview state" section of the system prompt for this turn. */
export function stateBlock({ interview, candidate, job, progress, target, kind, language, sttConfidence }) {
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

  const questions = screeningQuestions(job)
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
          `If they now say they don't want to, set videoDecision "no", say it's fine, ${afterVideoInstruction(questions)}`,
          "Otherwise gently remind them to press the record button, or the skip button if they changed their mind."
        )
      } else {
        lines.push(
          "Step: VIDEO OFFER.",
          "Ask (or you already asked) if they would like to record an optional 30–60 second intro video with their phone camera. Make clear it is optional.",
          `If yes: set videoDecision "yes" and tell them to press the record button below the chat.`,
          `If no: set videoDecision "no", say it's completely fine, ${afterVideoInstruction(questions)}`
        )
      }
      break

    case "SCREENING": {
      const idx = interview.screeningIdx
      const next = questions[idx + 1]
      lines.push(
        "Step: SCREENING QUESTIONS (ask in the candidate's language, in simple words).",
        `Current question ${idx + 1} of ${questions.length}: "${questions[idx]?.text}"${attemptNote}.`,
        next
          ? `After a usable answer, ask the next question: "${next.text}"`
          : "This is the LAST question. After a usable answer, thank them warmly and tell them clearly that their application is submitted. Say goodbye. Do not ask anything else."
      )
      break
    }

    case "DONE":
      lines.push(
        "Step: FINISHED. Thank the candidate warmly and tell them clearly that their application is submitted. Say goodbye. Do not ask anything."
      )
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
