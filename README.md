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

## Notes
- shadcn/ui runs in JS mode (`components.json` → `"tsx": false`) with the `base-nova` style (Base UI primitives: use `render={<Link />}` instead of `asChild`).
- npm 12 blocks package install scripts by default. The Prisma packages and `unrs-resolver` are approved in `package.json` (`allowScripts`).
