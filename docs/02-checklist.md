# 02 — Checklist

Mark `[x]` when done and verified. Each item has a short acceptance check.

## Phase 0 — Setup
- [x] Next.js app (App Router, **JavaScript**, Tailwind, ESLint): lint clean, `npm run build` passes
- [x] shadcn/ui set up in JS mode (`"tsx": false`); base components added in `src/components/ui`
- [x] Docker Postgres running (`candidhr-postgres`); own DB `hiring_poc` + own role `hiring_poc`; `DATABASE_URL` in `.env`
- [x] `.env.example` with all variables
- [x] Prisma schema (valid, client generated)
- [x] First migration `20261029064856_init` applied (10 tables)
- [x] Seed script: admin user from env (model pricing rows are added in Phase 3)
- [x] Seed run: admin user created with a bcrypt hash
- [x] Folder structure as in the plan (for Phase 0–1 files)

## Phase 1 — Admin auth
- [x] NextAuth credentials provider, bcrypt password check: correct login → session; wrong password / unknown email / bad email → 401; email is case- and space-insensitive
- [x] `/admin/login` page with an error message on bad login; a logged-in admin is redirected to `/admin`
- [x] Middleware protects `/admin/*` and `/api/admin/*`: `/admin` → 307 to login with `callbackUrl`, `/api/admin/*` → 401; after logout, access is blocked again
- [x] Admin layout with sidebar: Dashboard, Jobs, Candidates, AI Cost, Settings, Logout (placeholder pages for later phases; all return 200)
- [x] Dashboard counts verified with test data: jobs (2, 1 open), candidates (2), today's interviews (1, yesterday excluded), total AI cost (₹1.37 / $0.0163)

## Phase 2 — Jobs + link + QR
- [x] Jobs list (status, openings, applicants count) + All / Open / Closed filter
- [x] Create/edit form with all fields + custom screening questions (add/remove); validation on client and server (salary max ≥ min, duplicates removed)
- [x] AI provider/model selector per job ("Default" = `.env`)
- [x] Unique slug on create; never changes on edit, so printed QR codes keep working
- [x] Close (with confirmation) / reopen job; closed job → `/apply` shows "job closed"
- [x] Job detail shows the public link (copy button) and the QR code
- [x] QR **Download PNG** and **Print** poster (Hindi + English); all 3 QR images decode to the right link
- [x] AI-generated screening questions: generated on save, editable, regenerate button, cost logged via `AIUsage` (purpose `SCREENING_GEN`)
- [ ] AI generation tested with a real API key ⏳ *no keys in `.env` yet; failure path tested: job saves, admin sees a clear warning*
- [x] Model pricing seeded (3 Claude + 4 OpenAI models, checked 2026-10-29)

## Phase 3 — AI interview (candidate)
- [x] Provider interface + Claude provider + OpenAI provider (structured outputs, shared Zod schema)
- [x] `languages/en.json`, `languages/hi.json` + prompt files `prompts/en/*`, `prompts/hi/*`; auto-discovered (no i18n library)
- [x] `/apply/[slug]`: mobile-first, big buttons; closed-job screen; Noto Sans Devanagari font
- [x] Language picker (Hindi / English)
- [x] Voice-first chat UI: big 🎤 button as the main input, every AI question spoken aloud
- [x] Speech-to-text (Web Speech API, `hi-IN` / `en-IN`) sends the text + confidence (code done; ⏳ *needs a real phone — headless Chrome has no speech service*)
- [x] "Type instead" backup link; typing opens automatically if the browser has no speech-to-text
- [x] Speaker toggle (on by default) + 🔊 replay on each AI message
- [x] TTS voice matches the language (from `languages/<code>.json`)
- [x] Voice picking: preferred voice → exact lang → lang prefix → server TTS (Hindi is never read by an English voice) (⏳ *device-voice path needs a real phone; server path tested: 19 Hindi MP3s*)
- [x] `/api/interview/[id]/tts` server fallback (OpenAI `tts-1`, per-character cost logged exactly), cached on disk, rate-limited, only speaks this interview’s own AI messages
- [ ] Settings: TTS mode (browser/server/auto) + server voice per language → moved to Phase 5 (Settings page); today: `TTS_MODE` env + `serverVoice` in the language file
- [x] Server step machine: GREETING → CV → VIDEO → SCREENING → DONE
- [x] Each answer saved into the correct CV field (verified in DB: names transliterated, Hindi number words → digits, previous jobs structured)
- [x] Answer check 1, quality: relevant / clear / valid / misheard → GOOD / OKAY / POOR
- [x] Hard rules in code (phone 10 digits starting 6–9, age 18–65, numbers) on top of the AI check; canned re-ask in the candidate’s language
- [x] Low speech-to-text confidence (below 0.6) → passed to the AI to confirm "Did you say …?"
- [x] POOR → gentle re-ask in simpler words, max 2 retries, then flag + move on (verified: screening answer flagged after 3 unclear tries)
- [x] Answer check 2, job fit: POSITIVE / NEUTRAL / NEGATIVE + reason, never shown to the candidate
- [x] Every attempt saved in `AnswerCheck`; candidate `flaggedCount` updated
- [x] Duplicate block: same job + phone already submitted → polite stop (DUPLICATE); same phone still in progress on another device → old one ABANDONED, new one continues
- [x] Optional video: MediaRecorder up to 60 s (min 5 s), timer, review, retake, upload; "no" is never asked again (verified with fake camera: real WebM stored)
- [x] Storage abstraction: `local` driver writes to `/uploads`, `s3` driver stub with the same interface; admin-only `/api/media/*` with Range support
- [x] Screening: custom questions first, then AI-generated ones; answers saved in `ScreeningAnswer` with quality/fit
- [x] Thank-you screen; interview `COMPLETED`, `endedAt` set; reload still shows "submitted"
- [x] Summary + fit score (1–10) + reason generated after completion (in the background via `after()`)
- [x] Resume: reload the page → the chat continues (verified in browser)
- [x] Rate limit on public endpoints (per IP + per interview) → 429 with a friendly message
- [x] Usage + cost logged for every AI call, including prompt-cache reads/writes (cost uses discounted cache prices)
- [ ] Test on a real Android phone over HTTPS (mic, Hindi voice, camera) ⏳

## Phase 4 — Candidates
- [ ] List with columns: name, phone, job, experience, location, status, interview date, has video
- [ ] Filters: job, status, date range, language; search by name/phone; pagination
- [ ] Inline status change (New / Shortlisted / Rejected)
- [ ] Detail page: formatted CV, video player, screening Q&A, full transcript, summary + score
- [ ] ✅ / ⚠️ / ❌ quality + fit badge next to each CV field and screening answer (hover shows the reason)
- [ ] "Flagged answers" count in the list + filter "has flagged answers"
- [ ] CV PDF download

## Phase 5 — AI Cost + Settings
- [ ] Per-interview table: provider, model, input/output tokens, USD, INR, messages, duration
- [ ] Totals: per job, per day, per month, per provider, overall
- [ ] Settings: ModelPricing table editable (add/edit/deactivate), shows the USD→INR rate in use
- [ ] Costs calculated from the real token usage returned by the API

## Phase 6 — Finish
- [ ] README: setup, env, Docker Postgres, migrate, seed, run, how to add a language
- [ ] End-to-end manual test in Hindi and English on a mobile viewport
- [ ] Test on a real Android phone (mic + camera need HTTPS → use a tunnel such as ngrok)
