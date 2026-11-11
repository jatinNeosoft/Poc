# HireVoice — AI interview hiring (POC)

Hire blue-collar workers through a voice-first AI chat interview (Hindi / English).
Stack: Next.js 15 (App Router, JavaScript), Tailwind + shadcn/ui, PostgreSQL + Prisma, NextAuth.

Planning docs: [`docs/01-workflow.md`](docs/01-workflow.md), [`docs/02-checklist.md`](docs/02-checklist.md), [`docs/03-plan.md`](docs/03-plan.md).

## Setup

1. **Install**
   ```bash
   npm install
   ```
2. **Environment**: copy `.env.example` to `.env` and fill in:
   - `DATABASE_URL`: your Postgres container, for example `postgresql://postgres:postgres@localhost:5432/hiring_poc?schema=public`
   - `NEXTAUTH_SECRET`: generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
   - `ADMIN_EMAIL` / `ADMIN_PASSWORD`: the admin account created by the seed
3. **Database**: make sure the Postgres Docker container is running. Locally the POC uses its own role and database (`hiring_poc`) inside the shared `candidhr-postgres` container, so it doesn't touch that project's data. On a fresh Postgres, create them once:
   ```sql
   CREATE ROLE hiring_poc LOGIN CREATEDB PASSWORD '<password>';  -- CREATEDB is needed by `prisma migrate dev` (shadow DB)
   CREATE DATABASE hiring_poc OWNER hiring_poc;
   ```
   Then:
   ```bash
   npm run db:migrate -- --name init   # create tables
   npm run db:seed                     # create the admin user
   ```
4. **Run**
   ```bash
   npm run dev
   ```
   Open http://localhost:3000/admin/login.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build / start |
| `npm run db:migrate` | Create and apply a migration (dev) |
| `npm run db:deploy` | Apply migrations (prod) |
| `npm run db:seed` | Create or reset the admin user from `.env` |
| `npm run db:studio` | Browse the DB in Prisma Studio |

## Candidate interview

- Public link: `/apply/<job-slug>` (also in the job's QR code). Voice-first: browser speech-to-text, AI replies read aloud.
- **Mic and camera need HTTPS on phones** (only `localhost` is exempt). To test on a real phone, expose the dev server with a tunnel (e.g. `ngrok http 3000`) and set `APP_BASE_URL` to the tunnel URL so the QR code points there.
- Read-aloud: Google Cloud Text-to-Speech (Chirp 3 HD `en-IN` / `hi-IN` voices) — set `GOOGLE_TTS_API_KEY`. `TTS_MODE=server` (default) always uses the Google voice (~₹0.30 per message, logged); `auto` uses the phone's own `en-IN`/`hi-IN` voice when it has one; `browser` = phone voice only.
- Videos and cached TTS audio are stored in `/uploads` (`STORAGE_DRIVER=local`). Admins view videos via `/api/media/...`.

### Adding a language (no code changes)

1. Copy `languages/en.json` → `languages/<code>.json`; set `code`, `name`, `nativeName`, `sttLang` / `tts.lang` (e.g. `mr-IN`), preferred voice names, and translate the `labels`.
2. Copy `prompts/en/system.md` → `prompts/<code>/system.md` and adapt the "Language and style" section. (Other prompts fall back to English.)
3. Restart the app. The language appears on the language screen automatically.

### AI cost per interview (measured 2026-10-29, ~25 turns)

| Model | Cost per interview |
|---|---|
| `claude-opus-5-5` | ~₹28 (with prompt caching) |
| `claude-haiku-5-5` (default) | ~₹0.6 |
| Google voice (Chirp 3 HD), every AI message | ~₹6 |

Choose the model per job (Jobs → Edit → AI model), or change the default in **Settings → AI defaults**.

## Admin settings

**Settings** (stored in the `AppSetting` table) override `.env`:
- **AI defaults**: provider + default Claude/OpenAI model for jobs set to "Default" (`.env`: `AI_PROVIDER`, `CLAUDE_MODEL`, `OPENAI_MODEL`).
- **Read-aloud voice**: `auto` / `browser` / `server` + server voice per language (`.env`: `TTS_MODE`).
- **Model pricing**: US$ per 1M tokens (per 1M characters for `tts-*` voice rows, e.g. `tts-google-chirp3-hd`). Adding an active row makes that model selectable for jobs.
- **Currency**: ₹ per US$ (`.env`: `USD_TO_INR`). Applies to new AI calls; each usage row keeps the rate it was recorded with.

The **AI Cost** page shows cost per interview and totals by job, day, month, provider/model and purpose.

## Notes
- shadcn/ui runs in JS mode (`components.json` → `"tsx": false`) with the `base-nova` style (Base UI primitives: use `render={<Link />}` instead of `asChild`).
- npm 12 blocks package install scripts by default. The Prisma packages and `unrs-resolver` are approved in `package.json` (`allowScripts`).
