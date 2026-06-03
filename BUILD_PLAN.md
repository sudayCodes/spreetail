# BUILD_PLAN.md — Spreetail

> How Spreetail was researched, designed, built, and iterated with AI assistance.

---

## 1. Product Research

### How I Studied Splitwise

I reverse-engineered Splitwise by using the app as an active user across multiple scenarios: a group trip, a 1-on-1 friend expense, and a multi-person household split. I documented every screen, every state, and every edge case I encountered — what happens when someone pays the wrong amount, when a member is removed with outstanding debt, when you're both a creditor and a debtor in the same group.

I also read user complaints on Reddit and the App Store to understand what people found confusing or broken about Splitwise — especially the settle-up flow, which is the feature users complain about most.

### What I Learned

- The core value of Splitwise is not expense tracking — it's **debt clarity**. The single number "you owe $X to Y" is the product.
- Users primarily care about two moments: adding an expense quickly, and knowing how to settle up without awkward conversations.
- The "simplify debts" feature (reducing N payments to fewer transactions) is powerful but adds complexity most users don't understand.
- Friend relationships and group relationships are fundamentally the same data structure — Splitwise treats them differently in the UI but the underlying ledger is identical.
- Most users pay outside the app (UPI, cash, bank transfer) and just want to *record* that a payment happened.

### Workflows Identified

1. **Onboarding** — Sign up → create a group or add a friend → invite via link or email
2. **Add expense** — Enter description, amount, who paid, who owes what (equal / unequal / % / share)
3. **Check balances** — See who owes whom in a group, and the overall net on the dashboard
4. **Settle up** — Record that a payment happened; update the ledger
5. **Audit trail** — Review what was added, edited, and paid in a group over time
6. **Invite flow** — Join a group via shareable link or QR code without needing to be added manually

### Product Assumptions Made

- Users pay on external platforms (UPI, cash). The app is a ledger, not a payment processor.
- The primary use case is a college group trip — not long-term household sharing. This shaped the simpler schema (no recurring expenses, no budget limits).
- A direct friend relationship is just a 2-member group. This eliminated a separate "friends" data model entirely.
- Notifications are email-only (no push, no SMS) to keep the stack simple within the 3-day timeline.
- Simplify Debts was intentionally cut — it adds UI complexity and the math requires a separate algorithm pass that doesn't fit in a 3-day MVP.

---

## 2. Architecture

### Tech Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Frontend + API | Next.js 16 (App Router) | Server Components reduce client bundle; API routes live in the same repo |
| Database | Supabase (PostgreSQL) | Managed Postgres + Auth + Realtime + row-level security in one service |
| Auth | Supabase Auth | Email/password sessions via HTTP-only cookies, no JWT boilerplate |
| Real-time | Supabase Realtime (postgres_changes) | Group chat updates without polling |
| Email | Resend SDK | Simple transactional email; free tier covers the MVP volume |
| Charts | Recharts | Lightweight, works with React without a canvas setup |
| QR codes | `qrcode` npm | Client-side generation, no external service needed |
| Hosting | Vercel | Zero-config Next.js deploy; environment variables in dashboard |

### Database Schema

Eight tables. All money stored as **integer cents** to avoid floating-point rounding.

```
profiles          — extends auth.users; stores display name
groups            — id, name, type (group|direct), invite_token
group_members     — group_id, user_id (join table)
expenses          — group_id, paid_by, total_amount, split_type, category
expense_splits    — expense_id, user_id, amount_owed (one row per person per expense)
settlements       — group_id, payer_id, receiver_id, amount
messages          — group_id, sender_id, content (group chat)
activity_log      — group_id, actor_id, action_type, description (audit trail)
```

**Key design decision — "Everything is a Group":** Friend (1-on-1) relationships are stored as `groups` with `type = 'direct'`. All expense logic, balance calculation, chat, and settle-up is identical for both. No separate friends table.

**Balance formula (implemented as Supabase RPC):**
```
net_balance =
  SUM(expenses.total_amount WHERE paid_by = user)   -- money fronted
  - SUM(expense_splits.amount_owed WHERE user_id = user)  -- own share
  + SUM(settlements.amount WHERE payer_id = user)   -- payments sent
  - SUM(settlements.amount WHERE receiver_id = user) -- payments received
```
Positive = owed money. Negative = owes money.

### API Design

REST via Next.js App Router API routes. No GraphQL — the data access patterns are simple and predictable enough that REST is sufficient.

| Route | Purpose |
|-------|---------|
| `GET/POST /api/groups` | List / create groups |
| `GET/POST /api/groups/[id]/expenses` | List / create expenses + splits |
| `GET/PUT /api/expenses/[id]` | Expense detail / edit |
| `GET /api/groups/[id]/balances` | All members' net balances (RPC) |
| `GET /api/groups/[id]/pairwise-debts` | Exact amount current user owes each member (RPC) |
| `GET/POST /api/groups/[id]/settlements` | History / record payment |
| `GET/POST /api/groups/[id]/members` | Add by email / remove |
| `GET/POST /api/groups/[id]/messages` | Chat history / send |
| `GET /api/groups/[id]/activity` | Activity log |
| `GET /api/dashboard` | Cross-group balance totals |
| `GET /api/users?email=` | Verify a user exists before adding |

**Auth pattern (critical):** The `sb_publishable_*` key format does not propagate `auth.uid()` into Postgres RLS server-side. All DB reads/writes use a **service role `createAdminClient()`** and authenticate the user manually via `supabase.auth.getUser()` before every operation. The service role client is a module-level singleton to avoid re-instantiation on every call.

### Frontend Structure

```
app/
  (auth)/login, /signup          — public auth pages
  (dashboard)/                   — shared layout with sidebar + bottom nav
    dashboard/                   — balance summary + chart + recent activity
    groups/                      — group list + group detail + expense forms
    friends/                     — direct (2-member) groups
    expenses/                    — all expenses across groups
    activity/                    — full audit trail
  api/                           — all REST endpoints
  join/[token]/                  — invite link handler

components/
  SettleUpButton                 — settle-up modal (pairwise debt aware)
  GroupChat                      — real-time chat with optimistic updates
  Sidebar / BottomNav            — responsive navigation

lib/
  supabase/server.ts             — createClient, createAdminClient (singleton), getAuthUser (React cache)
  supabase/client.ts             — browser client for client components
  balance.ts                     — calculateSplits, dollarsToCents, centsToDisplay
  email.ts                       — Resend wrappers (lazy init, fire-and-forget)
```

### Deployment Approach

- **Vercel** for Next.js hosting — connected to GitHub main branch, auto-deploys on push.
- **Supabase** for database, auth, and realtime — SQL migrations run manually in Supabase SQL Editor in numbered order.
- Environment variables in Vercel dashboard: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `NEXT_PUBLIC_APP_URL`.

---

## 3. AI Collaboration Process

### How I Instructed the AI

I used Claude (via Claude Code) as a senior pair programmer throughout the build. My instruction style was intentionally high-context and directive:

- I started each session by pointing to `AI_CONTEXT.md` as the source of truth, which the AI was expected to read before making any decisions.
- I described *what* I wanted to achieve, not *how* — letting the AI propose the implementation approach, which I then accepted, modified, or rejected.
- For bug work, I described the symptom and expected behavior rather than guessing the cause, letting the AI trace through the code to diagnose.
- I reviewed all code changes before they went into production.

**Example instruction style:**
> *"The settle up logic is broken — when A pays B, it's pre-filling B's total group balance instead of what A specifically owes B. Go through the codebase and figure out why, then fix it without touching anything unrelated."*

### What the AI Asked

The AI proactively clarified before implementing:

- Whether a schema change was needed or if the existing data structure could be queried differently (answer: no schema change needed — pairwise debt was already computable from `expense_splits JOIN expenses.paid_by`).
- Whether "settle all" meant a bulk payment API or a UX shortcut (answer: UX shortcut — auto-select when there's only one creditor).
- Whether the overpayment guard should use total balance or per-receiver balance (answer: per-receiver, after the AI identified the flaw in total-balance comparison).
- Trade-offs between React `cache()` for auth deduplication vs. passing user as a prop — confirmed to use `cache()` since it's scoped per request and doesn't leak across users.

### How I Answered

Short and direct. I confirmed the AI's diagnosis when correct, redirected when it was off, and added context about why a particular constraint existed (e.g., the publishable key RLS issue required the admin client pattern everywhere).

### How the Plan Evolved

The original 3-day plan was a straight-line build. Post-launch, it evolved into a bug-fix cycle once real usage exposed issues:

| Original plan | What actually happened |
|---------------|------------------------|
| Settle up works via net balance | Net balance was too coarse — pairwise debt RPC added |
| Expense edit updates splits | Split recalculation was gated on `member_ids` being provided — fixed to auto-fetch existing members |
| Overpayment guard on total balance | Guard had to move to pairwise receiver balance after the flaw was found |
| N API calls per group on dashboard | Replaced with a single `get_all_user_balances` RPC |
| `getUser()` called once per request | Was being called twice (layout + page) — fixed with React `cache()` |
| Friends page: one query per friend | Refactored from 3×N sequential calls to 2 parallel round-trips |

### How AI_CONTEXT.md Was Maintained

`AI_CONTEXT.md` was kept as the single source of truth throughout the project. It was updated:

- After every architectural decision (e.g., the admin client pattern, the "everything is a group" model)
- After every SQL migration was added
- After every API route was created
- After every bug was diagnosed and fixed, with a full entry in the Bug Registry (section 19) including root cause, affected files, and fix description

The rule: any future AI session can read `AI_CONTEXT.md` and reproduce the entire application from it.

---

## 4. Tradeoffs

### What I Simplified

- **Split types:** Implemented equal, unequal, percentage, and share — but not "adjust by item" (the Splitwise feature where each person picks line items from a receipt).
- **Balance display:** Showed net per-group balance rather than a per-person pairwise summary on the group page. The pairwise detail is only in the settle-up modal.
- **Settle-up flow:** Users record payments manually; there's no integration with payment apps (UPI, Razorpay, Stripe). The app is a ledger, not a payment processor.
- **Notifications:** Email only, no push notifications. Fire-and-forget — email failure never blocks the API response.
- **Real-time:** Only messages and activity log are real-time. Balances refresh on page navigation (not live).

### What I Hardcoded

- Email sender is `onboarding@resend.dev` (Resend test sender). Sending to verified domains requires updating the `FROM` field in `src/lib/email.ts`.
- App URL defaults to `https://spreetail-app.vercel.app` in several fallbacks — needs `NEXT_PUBLIC_APP_URL` in production.
- Activity log is insert-only. There's no delete or archive.
- Expense category list (`food / travel / hotel / entertainment / other`) is a fixed enum in the database.

### What I Avoided

- **Debt simplification algorithm** — reduces N payments to fewer transactions. Useful but adds a graph traversal pass and non-obvious UI.
- **Password reset** — Supabase supports it but wiring the email template and redirect flow was outside the 3-day scope.
- **Friend request / accept-decline flow** — adding a friend creates a direct group immediately. No confirmation step.
- **Budget limits / daily spending caps** — out of scope for the trip-splitting use case.
- **Recurring expenses** — not relevant for the primary persona (group trip).
- **Multi-currency** — all amounts stored in a single currency; no conversion.
- **Offline support** — purely server-rendered; no service worker or local cache.

### What I Would Improve with More Time

| Area | Improvement |
|------|-------------|
| Debt simplification | Implement the minimum-transactions algorithm to reduce the number of payments needed to settle a group |
| Pairwise display | Show a "you owe X to Y" breakdown directly on the group page, not just in the settle-up modal |
| Real-time balances | Subscribe to expense and settlement changes via Supabase Realtime so balances update without navigation |
| Expense receipts | Allow photo uploads attached to expenses (Supabase Storage) |
| Password reset | Wire Supabase's built-in reset flow with a custom email template |
| Mobile app | The web app is responsive but a native wrapper (Expo/Capacitor) would improve the UX for the primary mobile-first persona |
| Settle-up for creditors | Let the creditor record "I received $X from Y" rather than requiring the debtor to initiate |
| Vercel cold starts | Move the middleware and frequently-hit routes to Edge Runtime for sub-50ms cold starts |
| Test coverage | Zero automated tests currently. At minimum: unit tests for `calculateSplits` and `get_pairwise_debts` logic, integration tests for the settlement guard |
