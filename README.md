# Spreetail

Split expenses with friends — a Splitwise clone built in 3 days.

**Live:** https://spreetail-app.vercel.app

---

## Features

- Email + password auth
- Create trip groups and 1-on-1 friend splits
- Add expenses — equal, unequal, percentage, or share split
- Real-time group chat
- Settle up with exact pairwise debt calculation
- Payment history and activity log
- Invite by email, shareable link, or QR code
- Email notifications on expense edits and settlements

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router) |
| Database + Auth | Supabase (PostgreSQL) |
| Real-time | Supabase Realtime |
| Email | Resend |
| Hosting | Vercel |

---

## Local Setup

### 1. Clone and install

```bash
git clone https://github.com/sudayCodes/spreetail
cd spreetail
npm install
```

### 2. Environment variables

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-or-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
RESEND_API_KEY=your-resend-api-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

| Variable | Where to find it |
|----------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Project Settings → API → `anon public` / publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Project Settings → API → `service_role` secret key |
| `RESEND_API_KEY` | resend.com → API Keys |
| `NEXT_PUBLIC_APP_URL` | Your deployment URL (use `http://localhost:3000` locally) |

### 3. Run database migrations

In the **Supabase SQL Editor**, run the files in this order:

```
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_helper_functions.sql
supabase/migrations/003_realtime.sql
supabase/migrations/004_pairwise_debts.sql
supabase/migrations/005_all_user_balances.sql
```

### 4. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Deployment (Vercel)

1. Push to GitHub
2. Connect the repo on [vercel.com](https://vercel.com)
3. Add all environment variables in Vercel → Project → Settings → Environment Variables
4. Deploy — Vercel auto-deploys on every push to `main`

Or deploy directly via CLI:

```bash
npx vercel --prod
```

---

## Project Structure

```
src/
  app/
    (auth)/          # login, signup
    (dashboard)/     # all authenticated pages
    api/             # REST API routes
  components/        # SettleUpButton, GroupChat, Sidebar, BottomNav
  lib/
    supabase/        # server + client Supabase helpers
    balance.ts       # split calculation logic
    email.ts         # Resend email wrappers
  types/
    database.ts      # Supabase type definitions
supabase/
  migrations/        # SQL migration files (run in order)
```

---

## Documentation

- [AI_CONTEXT.md](./AI_CONTEXT.md) — full architecture, schema, API reference, bug registry
- [BUILD_PLAN.md](./BUILD_PLAN.md) — product research, design decisions, tradeoffs
