# 03 — Implementation Plan

## 1. Tech decisions

| Area | Choice | Notes |
|---|---|---|
| Framework | Next.js 15, App Router, **JavaScript** (`.js`/`.jsx`) | No TypeScript (overrides the "TypeScript" line in the requirements) |
| Styling | Tailwind CSS + **shadcn/ui** | Set up in JS mode (`components.json` → `"tsx": false`), so the components are generated as `.jsx` |
| Icons / charts / toasts | `lucide-react`, shadcn `chart` (Recharts), `sonner` | Charts for the dashboard and AI Cost tab |
| Tables | shadcn `table` + `@tanstack/react-table` | Candidates and AI Cost lists (sort, filter, paginate) |
| DB | PostgreSQL (existing Docker container) + Prisma | Migrations + seed |
| Auth | NextAuth v4, Credentials provider, JWT session, `bcryptjs` | Middleware guard |
| Validation | Zod | API bodies + AI tool output |
| AI | `@anthropic-ai/sdk`, `openai` behind `lib/ai` interface | One forced-tool call per turn |
| QR | `qrcode` | Data URL for screen, PNG route for download |
| PDF | `@react-pdf/renderer` (server route) | CV download |
| Languages | Simple config: `languages/<code>.json` + `prompts/<code>/`, **no i18n library** | The UI is voice-first, with only about 15 on-screen labels |
| Speech (STT) | Browser Web Speech API, `lang` = `hi-IN` / `en-IN` from the language file | Free. Voice-first: big 🎤 button is the main input, "type instead" link as backup (also shown automatically if the browser has no STT) |
| Speech (TTS) | Language-matched voice: browser `speechSynthesis` first, server TTS as fallback | See "TTS voice per language" below |
| Video | `MediaRecorder` (webm) → multipart upload | Storage driver: `local` / `s3` |
| Rate limit | In-memory sliding window (POC) | Interface allows swapping in Redis later |

### AI design: one forced tool per turn
Each turn sends the system prompt plus history and forces the tool `interview_turn`:
```js
{ reply: string,                       // message shown to the candidate
  cvUpdates: { fullName?, phone?, age?, gender?, city?, willingToRelocate?,
               education?, totalExperienceYears?, previousJobs?[], skills?[],
               languagesKnown?[], certifications?[], currentSalary?,
               expectedSalary?, joiningDate? },
  screeningAnswer?: { questionId, answer },
  videoDecision?: "yes" | "no",
  answerCheck: {                       // judges the candidate's LAST answer
    target: string,                    // CV field key or screening question id
    relevant: boolean,                 // did they answer what was asked?
    clear: boolean,                    // specific enough? ("some years" → false)
    valid: boolean,                    // format rules (phone 10 digits, age 18–65…)
    misheard: boolean,                 // text looks garbled / speech-to-text error
    quality: "GOOD" | "OKAY" | "POOR",
    fit: "POSITIVE" | "NEUTRAL" | "NEGATIVE" | "NA",  // content vs job needs
    fitReason?: string                 // e.g. "Job needs night shifts; candidate said no"
  },
  needsClarification: boolean }
```

### Screening questions are asked by the server (Phase 4 change)
Smaller models sometimes mixed up "summarise the current answer" and "ask the next question" in one reply, so screening answers landed under the wrong question. Now:
- When the interview reaches the video step, the job's screening questions are frozen for that interview and translated once into its language (`prompts/<lang>/translate-questions.md`, purpose `TRANSLATION`).
- During screening the model only acknowledges the answer (or re-asks); the server appends the next question word-for-word, and the localized "application submitted" line at the end.

### Answer validation (two checks on every answer, in the same AI call, at no extra cost)
1. **Answer quality**: is it relevant, clear, valid, and heard correctly?
   - Speech-to-text confidence from the browser is sent with the message. If confidence is below 0.6 or `misheard` is true, the AI asks "Did you say …?"
   - Hard rules are also checked in code (phone regex, age range, numbers), so the AI is not the only judge.
   - If the answer is `POOR`, the AI re-asks gently in different, simpler words. After **2 retries** it accepts the best answer, moves on, and sets `flagged = true`.
2. **Job fit (content)**: is the answer good for *this* job?
   - The AI compares the answer with the job's requirements (skills, experience, shift, licence, location and so on). For example, the job needs a driving licence and the candidate has none, so `fit = NEGATIVE`.
   - The AI **never tells the candidate** about a negative fit. It stays friendly and continues. Fit is only for the admin.
   - At the end, the summary step uses all the answer checks to produce the fit score (1–10) and its reason.

Every check is stored in `AnswerCheck` (see the schema). The admin sees ✅ / ⚠️ / ❌ next to each CV field and screening answer, plus a "Flagged answers" count.
- **Update (Phase 2):** current Claude models (Opus 5.5, Sonnet 5.5) reject forced `tool_choice`, so both providers use **structured outputs** with one shared Zod schema instead:
  - Claude: `client.messages.parse({ output_config: { format: zodOutputFormat(schema), effort } })`
  - OpenAI: `client.responses.parse({ text: { format: zodTextFormat(schema, name) } })`
  - Same `{ data, usage }` result from both providers (`src/lib/ai/`). OpenAI strict schemas need `.nullable()` instead of `.optional()`.
- Default models: Claude `claude-haiku-5-5` (switched from Opus on 2026-10-29 for cost: ~₹0.6 vs ~₹28 per interview), OpenAI `gpt-6.1-sol` (override with `CLAUDE_MODEL` / `OPENAI_MODEL` or per job).
- The server validates the output with Zod, merges `cvUpdates`, and decides the next step.
- Models are configurable through env and per job. The defaults are a fast, low-cost model from each provider, which keeps per-interview cost low. Exact model IDs and prices will be checked against the current provider docs when the seed is written.

### TTS voice per language
The voice changes with the candidate's chosen language: Hindi replies are spoken in a Hindi voice and English replies in an Indian-English voice.

- **Language file** sets the voice for each language, so a new language only needs one JSON file plus its prompt folder:
  ```json
  // languages/hi.json
  { "code": "hi", "name": "Hindi", "nativeName": "हिंदी",
    "sttLang": "hi-IN",
    "tts": { "lang": "hi-IN", "preferredVoices": ["Google हिन्दी", "Lekha", "Microsoft Swara"],
             "rate": 0.9, "serverVoice": "hi-IN-female" },
    "labels": { "tapToSpeak": "बोलने के लिए दबाएँ", "listening": "सुन रहे हैं…",
                "typeInstead": "लिखकर बताएँ", "send": "भेजें", "recordVideo": "वीडियो बनाएँ",
                "skip": "छोड़ें", "submitted": "आपका आवेदन जमा हो गया", "jobClosed": "यह नौकरी बंद है" } }
  // languages/en.json — same shape, sttLang/tts.lang "en-IN"
  ```
- **Voice selection** (`src/lib/tts/browser.js`), tried in order:
  1. A voice in `preferredVoices` that is installed on the device
  2. Any voice whose `lang` matches exactly (`hi-IN`)
  3. Any voice whose language prefix matches (`hi`)
  4. If none of these is found, use **server TTS**. Never read Hindi aloud with an English voice.
- **Server TTS fallback** (`/api/tts`, rate-limited) works through a `ttsProvider` interface. The first driver is OpenAI TTS, with Google Cloud TTS (`hi-IN` / `en-IN` Wavenet voices) as an option. It returns an MP3 that the chat plays. Generated audio is cached by a hash of the text and voice, and its cost is logged in `AIUsage` with the purpose `TTS`.
- **UI**: one large speaker toggle (on by default) and a 🔊 replay button on each AI message. When the language changes, the voice changes immediately.
- **Admin Settings**: the TTS mode (`browser` / `server` / `auto`, default `auto`) and the server voice for each language.
- **Env**: `TTS_MODE=auto`, `TTS_PROVIDER=openai`.

### shadcn/ui components used
| Where | Components |
|---|---|
| Admin shell | `sidebar`, `breadcrumb`, `avatar`, `dropdown-menu`, `separator`, `sheet` (mobile menu) |
| Dashboard | `card`, `chart`, `skeleton` |
| Jobs | `form` (react-hook-form + Zod), `input`, `textarea`, `select`, `badge`, `button`, `dialog` (QR view), `alert-dialog` (close job), `tooltip` |
| Candidates | `table`, `tabs` (CV / Video / Answers / Transcript / Summary), `select` (status), `popover` + `calendar` (date filter), `command` (job filter search), `pagination`, `scroll-area` |
| AI Cost | `table`, `tabs` (per job / day / month / provider), `card`, `chart` |
| Settings | `form`, `input`, `switch`, `radio-group` (TTS mode) |
| Candidate interview | `button` (large-size variant), `card`, `scroll-area`, `progress` (interview steps), `dialog` (video recorder), `sonner` toasts |

Candidate pages use the same components with bigger sizing (`h-14` buttons, `text-lg`) for low-end Android phones.

## 2. Folder structure

```
poc/
├─ docs/                          # these planning docs
├─ prisma/
│  ├─ schema.prisma
│  ├─ migrations/
│  └─ seed.js                     # admin + ModelPricing
├─ prompts/
│  ├─ en/
│  │  ├─ config.json              # field order, greeting style, validation hints
│  │  ├─ system.md                # recruiter persona + rules
│  │  ├─ steps.md                 # per-step instructions
│  │  ├─ screening-gen.md         # generate 2–4 questions from job
│  │  └─ summary.md               # summary + fit score
│  └─ hi/ (same files)
├─ languages/
│  ├─ en.json                     # sttLang, tts voices, ~15 labels
│  └─ hi.json
├─ uploads/                       # local video storage (gitignored)
├─ src/
│  ├─ app/
│  │  ├─ layout.jsx, page.jsx
│  │  ├─ admin/
│  │  │  ├─ login/page.jsx
│  │  │  └─ (panel)/              # layout with sidebar
│  │  │     ├─ layout.jsx
│  │  │     ├─ page.jsx           # dashboard
│  │  │     ├─ jobs/page.jsx, new/page.jsx, [id]/page.jsx, [id]/edit/page.jsx
│  │  │     ├─ candidates/page.jsx, [id]/page.jsx
│  │  │     ├─ ai-cost/page.jsx
│  │  │     └─ settings/page.jsx
│  │  ├─ apply/[slug]/page.jsx    # candidate interview
│  │  └─ api/
│  │     ├─ auth/[...nextauth]/route.js
│  │     ├─ admin/jobs/…, candidates/…, pricing/…, costs/…
│  │     ├─ admin/jobs/[id]/qr/route.js        # PNG download
│  │     ├─ admin/candidates/[id]/pdf/route.js # CV PDF
│  │     ├─ public/jobs/[slug]/route.js        # job info + languages
│  │     ├─ interview/start/route.js
│  │     ├─ interview/[id]/route.js            # resume (GET)
│  │     ├─ interview/[id]/message/route.js
│  │     ├─ interview/[id]/video/route.js
│  │     └─ media/[...path]/route.js           # serve videos (admin only)
│  ├─ components/
│  │  ├─ ui/     (shadcn generated .jsx components)
│  │  ├─ admin/  (Sidebar, StatCard, DataTable, JobForm, QrCard, StatusBadge…)
│  │  └─ interview/ (LanguagePicker, ChatWindow, MicButton, VideoRecorder…)
│  ├─ lib/
│  │  ├─ prisma.js, auth.js, rateLimit.js, validators.js, slug.js
│  │  ├─ languages.js             # scans languages/ + prompts/ at startup
│  │  ├─ answerRules.js           # hard checks: phone, age, numbers
│  │  ├─ cost.js                  # tokens × pricing → USD/INR
│  │  ├─ storage/ index.js, local.js, s3.js
│  │  ├─ ai/ index.js, claude.js, openai.js, tools.js
│  │  └─ interview/ engine.js (step machine), prompts.js, summary.js
│  └─ middleware.js
├─ .env.example
├─ docker-compose.yml             # optional, only if you want Postgres in compose
└─ README.md
```

## 3. Prisma schema (draft)

```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }

enum JobType         { FULL_TIME PART_TIME CONTRACT }
enum JobStatus       { OPEN CLOSED }
enum CandidateStatus { NEW SHORTLISTED REJECTED }
enum InterviewStatus { IN_PROGRESS COMPLETED ABANDONED DUPLICATE }
enum InterviewStep   { GREETING CV VIDEO SCREENING DONE }
enum MessageRole     { USER ASSISTANT SYSTEM }
enum AIProvider      { CLAUDE OPENAI }
enum AIPurpose       { INTERVIEW_TURN SCREENING_GEN SUMMARY TTS }
enum VideoChoice     { PENDING YES NO }
enum AnswerQuality   { GOOD OKAY POOR }
enum AnswerFit       { POSITIVE NEUTRAL NEGATIVE NA }

model Admin {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  name         String?
  createdAt    DateTime @default(now())
}

model Job {
  id                  String     @id @default(cuid())
  slug                String     @unique
  title               String
  description         String
  location            String
  salaryMin           Int?
  salaryMax           Int?
  jobType             JobType
  openings            Int        @default(1)
  requiredSkills      String[]
  experienceRequired  String?
  customQuestions     String[]               // admin's screening questions
  generatedQuestions  String[]               // AI-generated 2–4
  aiProvider          AIProvider?            // null → env default
  aiModel             String?
  status              JobStatus  @default(OPEN)
  createdAt           DateTime   @default(now())
  updatedAt           DateTime   @updatedAt
  candidates          Candidate[]
  interviews          Interview[]
  aiUsages            AIUsage[]
}

model Candidate {                              // one application = one candidate row per job
  id                   String          @id @default(cuid())
  jobId                String
  job                  Job             @relation(fields: [jobId], references: [id])
  fullName             String?
  phone                String?
  age                  Int?
  gender               String?
  city                 String?
  willingToRelocate    Boolean?
  education            String?
  totalExperienceYears Float?
  previousJobs         Json?           // [{company, role, duration}]
  skills               String[]
  languagesKnown       String[]
  certifications       String[]
  currentSalary        String?
  expectedSalary       String?
  joiningDate          String?         // free text like "next Monday" + parsed later if needed
  status               CandidateStatus @default(NEW)
  aiSummary            String?
  fitScore             Int?
  fitReason            String?
  flaggedCount         Int             @default(0)
  createdAt            DateTime        @default(now())
  updatedAt            DateTime        @updatedAt
  interview            Interview?
  screeningAnswers     ScreeningAnswer[]
  video                Video?

  @@unique([jobId, phone])                     // duplicate protection
  @@index([status])
}

model Interview {
  id            String          @id @default(cuid())
  jobId         String
  job           Job             @relation(fields: [jobId], references: [id])
  candidateId   String          @unique
  candidate     Candidate       @relation(fields: [candidateId], references: [id])
  language      String                          // "en", "hi", …
  provider      AIProvider
  model         String
  status        InterviewStatus @default(IN_PROGRESS)
  step          InterviewStep   @default(GREETING)
  videoChoice   VideoChoice     @default(PENDING)
  screeningIdx  Int             @default(0)
  resumeToken   String          @unique
  startedAt     DateTime        @default(now())
  endedAt       DateTime?
  messages      Message[]
  aiUsages      AIUsage[]
  answerChecks  AnswerCheck[]
  @@index([jobId, startedAt])
}

model AnswerCheck {                              // one row per answer attempt
  id            String        @id @default(cuid())
  interviewId   String
  interview     Interview     @relation(fields: [interviewId], references: [id], onDelete: Cascade)
  messageId     String?                          // the candidate's message being judged
  target        String                           // CV field key ("phone") or "screening:<order>"
  question      String
  answer        String
  inputMode     String                           // "voice" | "text"
  sttConfidence Float?
  relevant      Boolean
  clear         Boolean
  valid         Boolean
  misheard      Boolean
  quality       AnswerQuality
  fit           AnswerFit     @default(NA)
  fitReason     String?
  attempt       Int           @default(1)        // 1..3
  flagged       Boolean       @default(false)    // still POOR after 2 retries
  createdAt     DateTime      @default(now())
  @@index([interviewId, target])
}

model Message {
  id           String      @id @default(cuid())
  interviewId  String
  interview    Interview   @relation(fields: [interviewId], references: [id], onDelete: Cascade)
  role         MessageRole
  content      String
  inputTokens  Int?
  outputTokens Int?
  createdAt    DateTime    @default(now())
  @@index([interviewId, createdAt])
}

model ScreeningAnswer {
  id          String    @id @default(cuid())
  candidateId String
  candidate   Candidate @relation(fields: [candidateId], references: [id], onDelete: Cascade)
  question    String
  answer      String
  source      String                           // "custom" | "ai"
  order       Int
  quality     AnswerQuality?                   // final check result (copied from AnswerCheck)
  fit         AnswerFit?
  fitReason   String?
  flagged     Boolean   @default(false)
  createdAt   DateTime  @default(now())
}

model Video {
  id          String    @id @default(cuid())
  candidateId String    @unique
  candidate   Candidate @relation(fields: [candidateId], references: [id], onDelete: Cascade)
  storageKey  String                           // driver-agnostic key
  url         String
  mimeType    String
  durationSec Int?
  sizeBytes   Int?
  createdAt   DateTime  @default(now())
}

model AIUsage {
  id           String     @id @default(cuid())
  interviewId  String?
  interview    Interview? @relation(fields: [interviewId], references: [id])
  jobId        String?
  job          Job?       @relation(fields: [jobId], references: [id])
  purpose      AIPurpose
  provider     AIProvider
  model        String
  inputTokens  Int
  outputTokens Int
  costUsd      Decimal    @db.Decimal(12, 6)
  costInr      Decimal    @db.Decimal(12, 4)
  usdToInr     Decimal    @db.Decimal(10, 4)   // rate snapshot
  createdAt    DateTime   @default(now())
  @@index([createdAt])
  @@index([provider])
}

model ModelPricing {
  id                 String     @id @default(cuid())
  provider           AIProvider
  model              String
  inputPerMillionUsd  Decimal   @db.Decimal(10, 4)
  outputPerMillionUsd Decimal   @db.Decimal(10, 4)
  active             Boolean    @default(true)
  updatedAt          DateTime   @updatedAt
  @@unique([provider, model])
}
```

## 4. Environment variables (`.env.example`)

```
DATABASE_URL=postgresql://user:pass@localhost:5432/poc_hiring
NEXTAUTH_SECRET=change-me
NEXTAUTH_URL=http://localhost:3000
APP_BASE_URL=http://localhost:3000
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=Admin@123
AI_PROVIDER=claude            # claude | openai
CLAUDE_MODEL=                 # default model id
OPENAI_MODEL=
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
USD_TO_INR=84
TTS_MODE=auto                 # browser | server | auto
TTS_PROVIDER=openai           # openai | google
STORAGE_DRIVER=local          # local | s3
RATE_LIMIT_PER_MIN=20
```

## 5. Build order (each phase ends with a demo to you)

| # | Phase | Output | Est. |
|---|---|---|---|
| 0 | Setup | App skeleton, Prisma schema, migration, seed, `.env.example` | 0.5 day |
| 1 | Auth + admin shell | Login, middleware, sidebar layout, dashboard counts | 0.5 day |
| 2 | Jobs + link/QR | CRUD, slug, QR PNG/print, AI screening-question generation | 1 day |
| 3 | AI interview | Provider layer, prompts en/hi, step engine, chat UI, voice, video, resume, rate limit, dup check, summary | 2–3 days |
| 4 | Candidates | List + filters, status edit, detail view, PDF | 1 day |
| 5 | AI cost + settings | Usage tables, totals, pricing editor | 0.5–1 day |
| 6 | README + E2E test | Docs, mobile test in hi/en | 0.5 day |

## 6. Risks and notes
- **Mic and camera need HTTPS** on phones (localhost is the only exception). For real-device testing we'll use a tunnel such as ngrok or cloudflared.
- **Web Speech API**: speech-to-text works on Android Chrome but not in some browsers (for example Firefox). Those users can still type. Server-side Whisper can be added later if needed.
- **Hindi TTS voices**: many cheap Android phones have the Google Hindi voice, but some don't. On those phones `auto` mode switches to server TTS, which costs a little per message (the cost is logged).
- **Hindi in the PDF** needs a Devanagari font (for example Noto Sans Devanagari) embedded in `@react-pdf`.
- **The in-memory rate limiter** resets on restart and doesn't work across multiple instances. That's fine for the POC, and Redis can replace it later.
- **Docker**: Docker Desktop was not running when I checked. I need the Postgres container details (host, port, DB name, user, password).
