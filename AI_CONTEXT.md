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
| GET | `/api/groups/[id]/pairwise-debts` | Exact amounts current user owes each group member |
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
| `004_pairwise_debts.sql` | `get_pairwise_debts(p_group_id, p_user_id)` — exact per-person debt for current user |

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

## 19. Bug Registry (post-Day 3)

Bugs are listed in fix priority order. Each entry has: root cause, affected files, and exact fix.

---

### BUG-01 — SettleUpButton pre-fills creditor's total group balance instead of current user's share
**Severity:** Critical  
**Status:** Fixed  
**Files:** `src/components/SettleUpButton.tsx:47`

**Root cause:**
```js
setAmount((creditor.balance / 100).toFixed(2))  // WRONG: creditor's total group balance
```
`creditor.balance` = sum of what the ENTIRE GROUP owes that person. In a 3-person group where Alice paid $90 (each owes $30), Alice's balance = +$60. When Bob opens settle-up and selects Alice, it pre-fills **$60** instead of **$30**. If Bob pays $60, his balance flips to +$30 (he becomes a creditor) and Alice's drops to $0. Charlie can never pay Alice back. Ledger is permanently corrupted.

**Fix:**
1. After fetching balances, extract the current user's own balance entry and store it in state (`myBalance`).
2. Change pre-fill: `Math.min(Math.abs(myBalance), creditor.balance)` — lesser of "what I owe total" and "what this creditor is owed".
3. Display current user's total debt at top of modal: "You owe $X total in this group".
4. Update dropdown label from `"owed $X"` (creditor's total) to `"you may owe: $X"` (the suggested payment).

**Limitation:** In multi-creditor scenarios (debtor owes multiple people), the min formula gives the best available suggestion but cannot compute exact pairwise amounts without a debt simplification algorithm. The amount field is editable so users can adjust.

---

### BUG-02 — Expense edit breaks balances when amount changes without member_ids
**Severity:** Critical  
**Status:** Not fixed  
**Files:** `src/app/api/expenses/[id]/route.ts:66`

**Root cause:**
```js
if (member_ids?.length) {
  await db.from('expense_splits').delete().eq('expense_id', id)
  const splits = calculateSplits(totalCents, member_ids, split_type, split_values)
  ...
}
```
If `amount` is updated but `member_ids` is not provided, `total_amount` is saved with the new value but old `expense_splits` rows are untouched. The balance formula then reads: `money_fronted = new amount` vs `share_owed = old stale splits`. Balances break silently.

**Fix:** When `member_ids` is absent but `amount` or `split_type` changed, fetch the existing split user_ids from `expense_splits` where `expense_id = id`, use those as `member_ids`, and recalculate splits with the new `totalCents`. Always keep splits in sync with `total_amount`.

---

### BUG-03 — No overpayment guard on settlement
**Severity:** Medium  
**Status:** Not fixed  
**Files:** `src/app/api/groups/[id]/settlements/route.ts:44`

**Root cause:** The settlements POST API inserts any amount with no validation. If a user overpays (e.g. due to BUG-01's wrong pre-fill), their balance flips positive (they become an accidental creditor) and the receiver's balance flips negative (they become an accidental debtor).

**Fix:** Before inserting, call `get_user_group_balance(groupId, userId)`. If `amountCents > Math.abs(currentBalance)`, return 400 with `"Amount exceeds what you owe in this group"`. This acts as a safety net independent of the UI fix in BUG-01.

---

### BUG-04 — API response lag on every tab/route
**Severity:** Medium  
**Status:** Not fixed  
**Files:** `src/lib/supabase/server.ts`, `src/app/api/dashboard/route.ts`, `src/app/(dashboard)/groups/[id]/page.tsx`

**Root causes (multiple):**

1. **`createAdminClient()` instantiates a new Supabase client on every call** — no module-level singleton. Every API route and Server Component that calls this re-creates the HTTP client from scratch.

2. **`supabase.auth.getUser()` is a round-trip network call on every request** — Vercel → Supabase Auth API → back. Adds ~50–150ms per request. Required for security (vs. reading session from cookies) but compounds with other latency.

3. **Dashboard N+1 pattern** — `src/app/api/dashboard/route.ts:18` calls `get_user_group_balance` once per group in `Promise.all`. For a user in 5 groups = 5 separate RPC calls to Supabase instead of 1.

4. **Sequential profile fetch after parallel data fetch** — `src/app/(dashboard)/groups/[id]/page.tsx:52` fetches profiles after the main `Promise.all` resolves instead of including it in the parallel batch.

5. **Vercel cold starts** — serverless functions on Vercel free tier can take 200–500ms to cold-start when idle.

**Fixes:**
1. Memoize `createAdminClient()` at module level so it's instantiated once per Vercel function lifecycle:
   ```js
   let _admin: ReturnType<typeof createSupabaseClient> | null = null
   export function createAdminClient() {
     return _admin ??= createSupabaseClient(url, key, opts)
   }
   ```
2. Dashboard: replace N individual `get_user_group_balance` RPCs with a single SQL query that aggregates all groups at once (new RPC `get_all_user_balances(p_user_id)`).
3. Group detail page: move the profile fetch inside the `Promise.all` by joining profiles directly in the member/expense/settlement queries instead of a separate follow-up query.

---

### BUG-05 — SettleUpButton modal gives no feedback on current user's total debt
**Severity:** Low (UX)  
**Status:** Not fixed  
**Files:** `src/components/SettleUpButton.tsx`

**Root cause:** The modal opens and shows who you can pay, but doesn't tell the current user how much they owe in total. There's no summary like "You owe $30 total in this group." Users have no reference point to know if a payment fully settles their debt.

**Fix:** After fetching balances, find the current user's entry and display their balance at the top of the modal. Also — if the current user has a positive or zero balance, show "You're settled up — nothing to pay" immediately on open instead of showing an empty creditors list.

---

### Fix order
1. BUG-01 (SettleUpButton wrong amount) — most visible, corrupts ledger
2. BUG-02 (expense edit stale splits) — data integrity
3. BUG-03 (overpayment guard) — safety net after BUG-01 fix
4. BUG-04 (lag) — `createAdminClient` singleton + dashboard N+1
5. BUG-05 (UX debt summary in modal)
