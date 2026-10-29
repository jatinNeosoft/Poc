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
- [ ] Jobs list (status, openings, applicants count)
- [ ] Create/edit form with all fields + custom screening questions (add/remove)
- [ ] AI provider/model selector per job
- [ ] Unique slug on create
- [ ] Close/reopen job
- [ ] Job detail shows the public link (copy button) and the QR code
- [ ] QR **Download PNG** works and **Print** opens a clean print view
- [ ] AI-generated screening questions (2–4) are created on save, editable, and their cost logged

## Phase 3 — AI interview (candidate)
- [ ] Provider interface + Claude provider + OpenAI provider (forced tool / function call)
- [ ] `languages/en.json`, `languages/hi.json` + prompt files `prompts/en/*`, `prompts/hi/*`; auto-discovered (no i18n library)
- [ ] `/apply/[slug]`: mobile-first, big buttons; closed-job screen
- [ ] Language picker (Hindi / English)
- [ ] Voice-first chat UI: big 🎤 button as the main input, every AI question spoken aloud
- [ ] Speech-to-text (Web Speech API, `hi-IN` / `en-IN`) sends the text + confidence
- [ ] "Type instead" backup link; typing opens automatically if the browser has no speech-to-text
- [ ] Speaker toggle (on by default) + 🔊 replay on each AI message
- [ ] TTS voice matches the language: Hindi → `hi-IN` voice, English → `en-IN` voice (from `languages/<code>.json`)
- [ ] Voice picking: preferred voice → exact lang → lang prefix → server TTS (Hindi is never read by an English voice)
- [ ] `/api/tts` server fallback (OpenAI TTS driver; Google driver optional), cached, rate-limited, cost logged
- [ ] Settings: TTS mode (browser/server/auto) + server voice per language
- [ ] Server step machine: GREETING → CV → VIDEO → SCREENING → DONE
- [ ] Each answer saved into the correct CV field (checked in the DB, not just the chat text)
- [ ] Answer check 1, quality: relevant / clear / valid / misheard → GOOD / OKAY / POOR
- [ ] Hard rules in code (phone 10 digits, age 18–65, numbers) on top of the AI check
- [ ] Low speech-to-text confidence (below 0.6) → "Did you say …?" confirmation
- [ ] POOR → gentle re-ask in simpler words, max 2 retries, then flag + move on
- [ ] Answer check 2, job fit: POSITIVE / NEUTRAL / NEGATIVE + reason, never shown to the candidate
- [ ] Every attempt saved in `AnswerCheck`; candidate `flaggedCount` updated
- [ ] Duplicate block: same job + phone that's already submitted → polite stop
- [ ] Optional video: MediaRecorder 30–60 s, preview, retake, upload; "no" is never asked again
- [ ] Storage abstraction: `local` driver writes to `/uploads`, `s3` driver stub with the same interface
- [ ] Screening: custom questions first, then AI-generated ones; answers saved in `ScreeningAnswer`
- [ ] Thank-you screen; interview `COMPLETED`, `endedAt` set
- [ ] Summary + fit score (1–10) + reason generated after completion
- [ ] Resume: close the tab, reopen the link, and the chat continues
- [ ] Rate limit on public endpoints (per IP + per interview) → 429 with a friendly message
- [ ] Usage + cost logged for every AI call

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
