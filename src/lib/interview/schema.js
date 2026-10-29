import { z } from "zod"
import { CV_FIELD_KEYS } from "./fields"

// Every field is required + nullable (OpenAI strict schemas don't allow optional fields)

const PreviousJob = z.object({
  company: z.string().nullable(),
  role: z.string().nullable(),
  duration: z.string().nullable(),
})

const CvUpdates = z.object({
  fullName: z.string().nullable(),
  phone: z.string().nullable(),
  age: z.number().int().nullable(),
  gender: z.string().nullable(),
  city: z.string().nullable(),
  willingToRelocate: z.boolean().nullable(),
  education: z.string().nullable(),
  totalExperienceYears: z.number().nullable(),
  previousJobs: z.array(PreviousJob).nullable(),
  skills: z.array(z.string()).nullable(),
  languagesKnown: z.array(z.string()).nullable(),
  certifications: z.array(z.string()).nullable(),
  currentSalary: z.string().nullable(),
  expectedSalary: z.string().nullable(),
  joiningDate: z.string().nullable(),
})

const AnswerCheck = z.object({
  relevant: z.boolean(),
  clear: z.boolean(),
  valid: z.boolean(),
  misheard: z.boolean(),
  quality: z.enum(["GOOD", "OKAY", "POOR"]),
  fit: z.enum(["POSITIVE", "NEUTRAL", "NEGATIVE", "NA"]),
  fitReason: z.string().nullable(),
})

// Order matters: the model judges and records the answer before it writes the reply
export const TurnSchema = z.object({
  answerCheck: AnswerCheck.nullable().describe("Check of the candidate's latest answer; null if it was not an answer"),
  cvUpdates: CvUpdates.describe("CV values the candidate gave in their latest message; null for the rest"),
  skippedFields: z.array(z.enum(CV_FIELD_KEYS)).describe("CV fields that do not apply or the candidate skipped"),
  screeningAnswer: z
    .string()
    .nullable()
    .describe("Short English summary of the answer to the CURRENT screening question only (null if not usable)"),
  videoDecision: z.enum(["yes", "no"]).nullable().describe("Only when they answered the video question"),
  reply: z
    .string()
    .describe("What you say next to the candidate, in their language: 1–3 short sentences, at most one question (follow the interview state)"),
})

export const SummarySchema = z.object({
  summary: z.string(),
  fitScore: z.number().int().describe("1 to 10"),
  fitReason: z.string(),
})

export const TranslationSchema = z.object({
  translations: z.array(z.string()).describe("One translation per question, same order"),
})
