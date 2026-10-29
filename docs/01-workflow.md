# 01 — Workflow Document

AI chat-interview hiring app for blue-collar workers.
Stack: Next.js (App Router, **plain JavaScript**), Tailwind CSS, PostgreSQL (Docker) + Prisma, NextAuth, Claude + OpenAI.

---

## 1. Actors

| Actor | What they do |
|---|---|
| **Admin** | Logs in, creates jobs, shares the link/QR, reviews candidates, tracks AI cost, edits pricing |
| **Candidate** | Opens the link/QR on a phone, picks a language, chats with the AI recruiter, optionally records a video, submits |
| **AI Recruiter** | Asks one short question at a time, extracts answers into CV fields, asks screening questions, writes summary + fit score |

---

## 2. Admin workflow

```
/admin/login ──► Dashboard
                   │
   ┌───────────────┼──────────────────┬───────────────┬──────────┐
   ▼               ▼                  ▼               ▼          ▼
 Jobs          Candidates          AI Cost        Settings   Logout
   │               │                  │               │
   │ create/edit   │ filter/search    │ per interview │ model pricing
   │ close         │ change status    │ totals: job / │ USD→INR (read)
   ▼               ▼                  │ day / month / │ default provider
 Job saved ──► slug + link      Candidate detail     provider / all
   │           /apply/[slug]     • CV (PDF download)
   │           QR (PNG/print)    • intro video
   ▼                             • screening answers
 AI generates 2–4 screening Qs   • full transcript
 (stored on job, cost logged)    • AI summary + fit score (1–10)
```

1. **Login**: email + password (bcrypt). One admin is seeded from `ADMIN_EMAIL` / `ADMIN_PASSWORD`. Every `/admin/*` route is protected by middleware.
2. **Create job**: title, description, location, salary min/max, job type, openings, required skills, experience required, custom screening questions, and the AI provider/model (defaults to `AI_PROVIDER`).
3. **On save**:
   - A unique slug is generated, so the public link becomes `APP_BASE_URL/apply/<slug>`.
   - A QR code is shown on the job page, with **Download PNG** and **Print** buttons.
   - The AI generates 2–4 extra screening questions from the job description. These are stored on the job and the admin can see and edit them.
4. **Close job**: the public link then shows "This job is closed".
5. **Candidates**: list with filters (job, status, date, language) and search (name/phone). Admin sets the status to New, Shortlisted or Rejected.
6. **Candidate detail**: CV, video, answers, transcript, summary and score.
7. **AI Cost**: every AI call is logged with its tokens. Cost = tokens × `ModelPricing` rate. INR uses the `USD_TO_INR` rate.

---

## 3. Candidate workflow (AI interview)

```
Scan QR / open link
        │
        ▼
/apply/[slug] ── job closed? ──► "Job closed" screen
        │
        ▼
Resume token in localStorage for this job?
   ├─ yes ──► load interview, show history, continue where left off
   └─ no  ──► Language screen  [ हिंदी ]  [ English ]
                    │
                    ▼
        Interview created (status IN_PROGRESS)
                    │
   ┌────────────────┴─────────────────────────────────────────┐
   │ STEP 1  GREETING   greeting + 2-line job explanation      │
   │ STEP 2  CV         one question at a time:                │
   │                    name → phone (validate, dup check) →   │
   │                    age → gender (optional) → city/area →  │
   │                    relocate → education → total exp →     │
   │                    previous jobs → skills → languages →   │
   │                    licences/certs → current/expected      │
   │                    salary → joining date                  │
   │ STEP 3  VIDEO      "Optional: record 30–60 sec intro?"    │
   │                    yes → camera recorder → upload         │
   │                    no  → never asked again                │
   │ STEP 4  SCREENING  admin's custom Qs, then AI-generated Qs│
   │ STEP 5  DONE       thank-you + "application submitted"    │
   └────────────────┬─────────────────────────────────────────┘
                    ▼
     Background: AI summary + fit score saved on candidate
```

### What happens on each chat turn

```
Candidate speaks (big 🎤 button → speech-to-text + confidence)
  or uses the "type instead" backup
        │
        ▼
POST /api/interview/[id]/message   (rate-limited, resume token required)
        │
        ▼
Server builds the prompt:
  language prompt files (/prompts/<lang>/*.md)
  + job info + current step + fields already filled + fields still missing
        │
        ▼
AI provider (Claude or OpenAI) called with ONE forced tool: `interview_turn`
  returns { reply, cvUpdates{}, screeningAnswer?, videoDecision?, stepDone }
        │
        ▼
Server validates the tool output (Zod) + hard rules (phone, age, numbers)
  → answer check: quality (relevant / clear / valid / misheard) + job fit
      POOR  → AI re-asks in simpler words (max 2 retries, then flag + move on)
      GOOD/OKAY → save CV field / screening answer
  → saves AnswerCheck row → advances the step state machine
  → stores both messages + token usage
        │
        ▼
Response: AI reply (+ UI hint, e.g. "show video recorder")
  → text-to-speech plays the reply in the chosen language's voice
     (Hindi → hi-IN voice, English → en-IN voice; if the phone has
      no matching voice → server TTS audio)
```

**Important rules**
- The **server** controls the steps; the AI does not. This keeps the flow predictable and lets it resume after a reconnect.
- The AI only ever asks **one short question** in simple words, in the chosen language.
- **Voice-first**: every AI question is spoken aloud, and the candidate answers by speaking. Typing is only a backup.
- **Answer check 1, quality**: is the answer relevant, clear, valid (phone has 10 digits, age is 18–65) and heard correctly? If the speech-to-text confidence is low, the AI asks "Did you say …?" If the answer is poor, the AI re-asks gently in simpler words. After 2 retries it moves on and flags the answer. "None" is accepted for education.
- **Answer check 2, job fit**: is the answer good for this job (licence, night shift, experience, and so on)? This is shown only to the admin. The AI never tells the candidate it was a bad answer.
- **Duplicate check**: when the phone number is captured, the server checks for the same job + phone. If an application is already submitted, the AI politely says so and the interview ends.
- **Resume**: on start, the server returns `interviewId + resumeToken`. These are kept in `localStorage` under the job slug. Reopening the link on the same device continues the interview.

---

## 4. Language workflow: adding a new language without code changes

There is no i18n library, because the app is voice-first and has only about 15 labels on screen.

1. Add `languages/<code>.json` with `name`, `nativeName`, `sttLang` (for example `mr-IN`), the TTS voices and about 15 labels.
2. Add a `prompts/<code>/` folder that copies the `en` prompt files, translated.
3. Restart the app. The language appears on the language screen automatically, because the folders are scanned at startup.

---

## 5. AI provider workflow

```
lib/ai/index.js  getProvider(name)  ──►  claudeProvider.js  (Anthropic SDK)
                                    └──►  openaiProvider.js  (OpenAI SDK)
Common interface:
  chat({ system, messages, tool, model }) → { toolInput, usage:{inputTokens, outputTokens}, raw }
Selection order: job.aiProvider/job.aiModel → env AI_PROVIDER / default model
Every call → AIUsage row (interviewId or jobId, purpose, tokens, costUsd, costInr)
```

AI purposes that are logged: `INTERVIEW_TURN`, `SCREENING_GEN`, `SUMMARY`.
