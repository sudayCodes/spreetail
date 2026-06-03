# AI_CONTEXT.md — Spreetail: Source of Truth

> Single source of truth for the project.
> Updated throughout development. The app must be reproducible from this file alone.

---

## 1. Project Overview

| Field | Value |
|-------|-------|
| Assignment | Reverse-engineer Splitwise, scope a 3-day MVP, build and deploy it |
| Timeline | 3 days (complete) |
| Live URL | https://spreetail-app.vercel.app |
| GitHub | https://github.com/sudayCodes/spreetail |
| Status | **Deployed and running** |

---

## 2. Problem Statement

Splitwise solves the social/financial conflict at the end of shared experiences where people forget what they paid, are too shy to ask for money back, and trust erodes. Without it: debts go untracked, people overpay or lose money silently.

---

## 3. Target User

**Primary persona:** College students going on a group trip.

Key characteristics: different budgets, pay on external platforms (UPI, cash), need a transparent shared ledger.

---

## 4. Success Criteria

Success = the shipped app is very close to the goals set at the start.

---

## 5. Minimum Product Requirements (Confirmed & Shipped)

| Feature | Status |
|---------|--------|
| Email + password auth (Supabase Auth) | ✅ |
| Create and manage groups | ✅ |
| Invite by email, invite link, QR code | ✅ |
| Remove member (blocked if unpaid debt) | ✅ |
| Add expense — equal, unequal, %, share split | ✅ |
| Real-time group chat (Supabase Realtime) | ✅ |
| Group-wise balance view with settled ✓ label | ✅ |
| Individual balance summary (dashboard) | ✅ |
| Settle debts / record payments | ✅ |
| Payment history panel in group detail | ✅ |
| Email on expense edit + settlement (Resend) | ✅ |
| Relational DB (PostgreSQL via Supabase) | ✅ |

---

## 6. Out-of-Scope (Confirmed)

- Budget-based splitting
- Drop-out / mid-trip recalculation
- Daily spending limits
- Password reset
- Friend requests / accept-decline flow
- Simplify group debts (stretch — not built)
- Collaborative whiteboard (stretch — not built)

---

## 7. Architecture

### Tech Stack

| Layer | Choice |
|-------|--------|
| Frontend + Backend | Next.js 16 (App Router, React Server Components) |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (email + password, sessions via cookies) |
| Real-time | Supabase Realtime (pub/sub, postgres_changes) |
| API style | REST (Next.js API routes) |
| Email | Resend SDK (lazy-initialized, fire-and-forget) |
| Charts | Recharts |
| QR codes | `qrcode` npm package |
| Hosting | Vercel + Supabase |

### Key Architectural Decisions

**"Everything is a Group" pattern:**
- Friend relationships = 2-member groups with `type = 'direct'`
- Trip groups = groups with `type = 'group'`
- All expense logic, splitting, chat, and balance calculation is identical for both

**Server client split (critical fix for RLS):**
- `createClient()` — anon key + session cookies, used **only** for `supabase.auth.getUser()`
- `createAdminClient()` — service role key, used for **all DB reads/writes** in API routes and Server Components
- Root cause: `sb_publishable_*` key format does not propagate `auth.uid()` into RLS server-side. Auth validated manually via `getUser()`.

**All money as integer cents:**
- `$30.50` → `3050` in DB, displayed as `(cents / 100).toFixed(2)`

---

## 8. Database Schema (Complete)

### `profiles` *(extends auth.users)*
| Column | Type |
|--------|------|
| id | uuid PK FK → auth.users |
| name | text |
| created_at | timestamptz |

*Auto-created on signup via trigger `on_auth_user_created`.*

### `groups`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| name | text | |
| type | enum | `'direct'` or `'group'` |
| invite_token | uuid UNIQUE | invite link + QR |
| created_at | timestamptz | |

### `group_members`
| Column | Type |
|--------|------|
| group_id | uuid FK → groups |
| user_id | uuid FK → auth.users |
| joined_at | timestamptz |

### `expenses`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| group_id | uuid FK → groups | |
| paid_by | uuid FK → auth.users | who fronted the money |
| description | text | |
| total_amount | integer | cents |
| split_type | enum | `equal / unequal / percentage / share` |
| category | enum | `food / travel / hotel / entertainment / other` |
| created_at | timestamptz | |
| updated_at | timestamptz | |
| updated_by | uuid FK → auth.users | null if never edited |

### `expense_splits`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| expense_id | uuid FK → expenses | |
| user_id | uuid FK → auth.users | who owes this share |
| amount_owed | integer | cents |

### `settlements`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| group_id | uuid FK → groups | |
| payer_id | uuid FK → auth.users | |
| receiver_id | uuid FK → auth.users | |
| amount | integer | cents |
| created_at | timestamptz | |

### `messages`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| group_id | uuid FK → groups | group = chat room |
| sender_id | uuid FK → auth.users | |
| content | text | |
| created_at | timestamptz | |

### `activity_log`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| group_id | uuid FK → groups | |
| actor_id | uuid FK → auth.users | |
| action_type | text | `CREATED_EXPENSE`, `EDITED_EXPENSE`, `RECORDED_SETTLEMENT`, `MEMBER_JOINED`, `MEMBER_ADDED`, `CREATED_GROUP` |
| description | text | human-readable |
| created_at | timestamptz | |

---

## 9. Balance Calculation Formula

```
net_balance (cents) =
  SUM(expenses.total_amount WHERE paid_by = U AND group_id = G)
  - SUM(expense_splits.amount_owed WHERE user_id = U AND expense.group_id = G)
  + SUM(settlements.amount WHERE payer_id = U AND group_id = G)
  - SUM(settlements.amount WHERE receiver_id = U AND group_id = G)
```

- Positive → others owe U (green)
- Negative → U owes others (red)
- Zero → Settled ✓ badge

Implemented as Supabase RPCs: `get_user_group_balance(p_group_id, p_user_id)` and `get_group_balances(p_group_id)`.

---

## 10. Split Type Logic (`src/lib/balance.ts`)

| Type | Input | Calculation |
|------|-------|-------------|
| `equal` | ignored | `floor(total / n)`, remainder to first member |
| `unequal` | dollar amounts per person | converted to cents |
| `percentage` | 0–100 per person (must sum to 100) | `floor(total * pct / 100)`, last gets remainder |
| `share` | share count per person | `floor(total * shares / totalShares)`, last gets remainder |

---

## 11. UI Screens

| Route | Screen |
|-------|--------|
| `/login` | Email + password login |
| `/signup` | Name + email + password |
| `/dashboard` | Total balance, list/chart toggle, recent activity |
| `/groups` | All trip groups |
| `/groups/[id]` | Balances (settled ✓ label), expenses, members, payment history, invite |
| `/groups/[id]/expenses` | All expenses in a group |
| `/groups/[id]/expenses/new` | Add expense (4 split types, per-person inputs) |
| `/groups/[id]/expenses/[id]` | Split breakdown, settle-up button, real-time chat |
| `/friends` | 2-member groups with per-friend balance |
| `/expenses` | All expenses across all groups |
| `/activity` | Full audit trail |
| `/join/[token]` | Invite link handler |

---

## 12. API Routes

| Method | Route | Purpose |
|--------|-------|---------|
| GET/POST | `/api/groups` | List / create group |
| POST/DELETE | `/api/groups/[id]/members` | Add by email / remove |
| GET | `/api/groups/[id]/balances` | All members' net balances |
| GET/POST | `/api/groups/[id]/expenses` | List / create expense + splits |
| GET/PUT | `/api/expenses/[id]` | Detail / edit |
| GET/POST | `/api/groups/[id]/settlements` | History / record payment |
| GET/POST | `/api/groups/[id]/messages` | Chat history / send |
| GET | `/api/groups/[id]/activity` | Activity log |
| GET | `/api/dashboard` | Cross-group balance totals |
| GET | `/api/users?email=` | Check if user exists by email |

---

## 13. Real-time

- Tables in `supabase_realtime` publication: `messages`, `activity_log`, `expense_splits`, `settlements`
- Chat: subscribes to `postgres_changes` INSERT on `messages` filtered by `group_id`
- Optimistic update: message appears immediately before DB INSERT confirms
- Dedup: incoming Realtime events checked against existing IDs before appending

---

## 14. Email Notifications (Resend)

- Sender: `onboarding@resend.dev` (test sender, no domain verification needed)
- To send to any address in prod: verify a domain in Resend dashboard → update `FROM` in `src/lib/email.ts`
- Triggered on: expense edited (all other group members), settlement recorded (receiver only)
- Fire-and-forget: `.catch(() => {})` — email failure never blocks API response
- Lazy init: `getResend()` returns `null` if `RESEND_API_KEY` missing — prevents build crash

---

## 15. Invite System

| Method | Flow |
|--------|------|
| By email | POST `/api/groups/[id]/members` → `get_user_id_by_email` RPC |
| Invite link | `/join/[token]` → lookup by `invite_token`, insert into `group_members` |
| QR code | Client-side `qrcode.toDataURL(inviteUrl)` → `<img>` |

**Friend add flow (pre-check prevents orphaned groups):**
1. `GET /api/users?email=` — confirm friend has an account
2. Create `direct` group named after friend's real name
3. POST `/api/groups/[id]/members` — add friend

---

## 16. Vercel Environment Variables

| Variable | Notes |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon/publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server-only) |
| `NEXT_PUBLIC_APP_URL` | `https://spreetail-app.vercel.app` |
| `RESEND_API_KEY` | Resend API key |

---

## 17. Supabase SQL Migrations

| File | Contents |
|------|----------|
| `001_initial_schema.sql` | All 8 tables, RLS policies, indexes, `on_auth_user_created` trigger |
| `002_helper_functions.sql` | `get_user_id_by_email`, `get_user_group_balance`, `get_group_balances`, `is_group_member` |
| `003_realtime.sql` | Adds tables to `supabase_realtime` publication |

Run all three in Supabase SQL Editor in order.

---

## 18. Known Risks & Mitigations Applied

| Risk | Mitigation |
|------|-----------|
| RLS not firing server-side with new key format | `createAdminClient()` (service role) for all DB ops |
| Floating point currency | Integer cents everywhere |
| Resend build crash without API key | Lazy `getResend()` init |
| Orphaned direct groups when friend add fails | Pre-check user existence before group creation |
| Optimistic chat duplicates | Dedup by message ID |

---

## 19. Bugs Noted (to fix after Day 3)

- User has a bug list — to be addressed in next session
