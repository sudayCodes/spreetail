# AI_CONTEXT.md — Splitwise Clone: Source of Truth

> Single source of truth for the project.
> Updated after every interview answer.
> The final app must be buildable from this file alone.

---

## 1. Project Overview

| Field | Value |
|-------|-------|
| Assignment | Reverse-engineer Splitwise, scope a 3-day MVP, build and deploy it |
| Timeline | 3 days |
| Status | **Interview complete — build plan pending** |

---

## 2. Problem Statement

Splitwise solves the social/financial conflict at the end of shared experiences (trips, dinners) where:
- People forget what they paid for others
- People are too shy to ask for money back
- Totals are unclear and trust erodes

Without this: trust breaks, expenses go untracked, people overpay or silently lose money.

---

## 3. Target User

**Primary persona:** College students going on a group trip.

Key characteristics:
- Different financial budgets — equal splitting doesn't always work
- Pay on external platforms (UPI, cash, Venmo) outside the app
- Need a transparent shared ledger everyone can see

---

## 4. User Frustrations with Real Splitwise

- External payments not marked → risk of double payment
- No budget-aware splitting
- Hard to handle members dropping mid-trip

---

## 5. Success Criteria

Success = the shipped app is very close to the goals set at the start.
Measured by: clear goal → achievable milestones → how close the final app is to that goal.

---

## 6. Minimum Product Requirements (Confirmed)

### 6.1 Auth
- Email + password login and signup
- Multiple device login: **allowed**, sessions tracked
- Password reset: **out of scope**
- No guest accounts

### 6.2 Groups & Friends (same system)
- Create a group (trip) or add a friend (1-on-1) — both are groups under the hood
- Add members by: email, invite link, QR code
- Remove a member (only if they have no unpaid debts)
- User can be in multiple groups simultaneously
- No special group owner role — all members equal

### 6.3 Expenses
- Any group member can add an expense
- Any group member can edit an expense (email notification sent to all with who edited + when)
- **Split types:** equal, unequal, by percentage, by share
- One split type per expense — no mixing
- Expenses belong to a **category** (fixed list: food, travel, hotel, entertainment, other)
- **Real-time chat** per expense (live updates via Supabase Realtime)

### 6.4 Balances
- Per-group balance: who owes whom in this group
- Cross-group total: "you owe $X total" and "you are owed $Y total" across all groups
- **Real-time updates** (Supabase Realtime, fallback: page refresh)

### 6.5 Settlements
- Any member records a payment (one-sided — payee does not need to confirm)
- Payee receives email notification immediately
- Settled debts show **"paid" label** → then move to **history**

### 6.6 Database
- Relational only (PostgreSQL via Supabase)

---

## 7. Stretch Goals (Time-Permitting)

| Feature | Notes |
|---------|-------|
| Collaborative Whiteboard | Free-text scratchpad per group. Last-save-wins. No admin. |
| Simplify Group Debts | Reduce N debts to minimum transactions. Flagged as complex. |

---

## 8. Out-of-Scope (Confirmed)

- Budget-based splitting
- Drop-out / mid-trip recalculation
- Daily spending limits
- Password reset
- Friend requests / accept-decline flow
- Simplify debts (unless time permits)

---

## 9. UI Screens

| Screen | Key Contents |
|--------|-------------|
| Login | Email + password form |
| Signup | Name, email, password |
| Dashboard | Total balance, you-owe list, you-are-owed list, list/chart toggle, add expense button, settle up button |
| Recent Activity | Audit trail: expense added, edited, payment recorded, member joined, member added |
| All Expenses | All expenses across all groups (paginated) |
| Friends List | All 2-member groups — shows the other person's name + balance |
| Groups | All groups with member count > 2, balance summary |
| Group Detail | Expense list, member list, add expense, group balance |
| Expense Detail | Split breakdown, real-time chat thread |

**Device:** Desktop-first, fully responsive.

---

## 10. Tech Stack

| Layer | Choice |
|-------|--------|
| Frontend + Backend | Next.js (React + API routes / Node.js) |
| Database | Supabase (PostgreSQL) |
| Auth | TBD — Supabase Auth or custom JWT |
| Real-time | Supabase Realtime (pub/sub channels) |
| API style | REST |
| Hosting | Vercel (Next.js app) + Supabase (DB + Realtime) |
| Repo | GitHub |

---

## 11. Real-time Architecture

- Supabase Realtime channels (rooms) used for pub/sub
- **Chat room:** one channel per expense — subscribed members get live chat messages
- **Balance room:** one channel per group — subscribed members get live balance updates
- Frontend subscribes to relevant rooms on page load; backend publishes on DB changes
- Fallback: page refresh if Realtime integration runs out of time

---

## 12. Architecture Shape

- **Backend (Next.js API routes):** all business logic — balance calculations, split math, pagination, group resolution, settlements
- **Frontend (Next.js React):** display layer only — renders JSON from backend
- **Communication:** REST for CRUD; Supabase Realtime for live events

---

## 13. Database Schema (Complete — Final)

> **Auth:** Supabase Auth handles identity, sessions, token refresh, and RLS. No custom JWT or sessions table needed.

### `profiles` *(extends Supabase auth.users)*
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK FK → auth.users | matches Supabase auth user id |
| name | text | display name |
| created_at | timestamptz | |

### `groups`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| name | text | |
| type | enum | `'direct'` (2-person friend) or `'group'` (trip) |
| invite_token | uuid UNIQUE | used to generate invite link + QR code |
| created_at | timestamptz | |

### `group_members` *(junction)*
| Column | Type | Notes |
|--------|------|-------|
| group_id | uuid FK → groups | |
| user_id | uuid FK → auth.users | |
| joined_at | timestamptz | |

### `expenses`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| group_id | uuid FK → groups | |
| paid_by | uuid FK → auth.users | who fronted the money |
| description | text | |
| total_amount | integer | **cents** — $30.50 → 3050 |
| split_type | enum | `'equal'` / `'unequal'` / `'percentage'` / `'share'` |
| category | enum | `'food'` / `'travel'` / `'hotel'` / `'entertainment'` / `'other'` |
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
| group_id | uuid FK → groups | where the debt occurred |
| payer_id | uuid FK → auth.users | who sent the money |
| receiver_id | uuid FK → auth.users | who received it |
| amount | integer | cents (**note:** user said Decimal, keeping as cents for consistency) |
| created_at | timestamptz | |

### `messages` *(group chat — not per-expense)*
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| group_id | uuid FK → groups | group = the chat room |
| sender_id | uuid FK → auth.users | |
| content | text | |
| created_at | timestamptz | |

> **Design note:** Chat is per-group (not per-expense) because the group is the channel in the "Everything is a Group" model. Real-time: frontend listens for INSERT on messages WHERE group_id = current group.

### `activity_log`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| group_id | uuid FK → groups | |
| actor_id | uuid FK → auth.users | who did the action |
| action_type | text | e.g. `'CREATED_EXPENSE'`, `'EDITED_EXPENSE'`, `'RECORDED_SETTLEMENT'`, `'MEMBER_JOINED'`, `'MEMBER_ADDED'` |
| description | text | human-readable e.g. "Alex added a $50 expense for Uber" |
| created_at | timestamptz | |

---

## 14. Balance Calculation Formula

For user **U** in group **G**:

```
net_balance =
  SUM(expenses.total_amount WHERE paid_by = U AND group_id = G)   -- money U fronted
  - SUM(expense_splits.amount_owed WHERE user_id = U AND expense.group_id = G)  -- U's share of all expenses
  + SUM(settlements.amount WHERE payer_id = U AND group_id = G)   -- money U has paid out
  - SUM(settlements.amount WHERE receiver_id = U AND group_id = G) -- money U has received
```

- **Positive** → others owe U money
- **Negative** → U owes others money

---

## 15. Known Risks (User-Identified)

| Risk | Mitigation |
|------|-----------|
| Real-time UI state sync | Use Supabase Realtime carefully; fallback = refresh |
| Simplify debts complexity | **MVP keeps it literal** — A owes B, A pays B. No graph reduction. |
| Floating point currency | **Store all amounts as integer cents** (e.g. $30.50 → 3050) |

---

## 16. Testing

- Try basic tests if time allows
- Manual testing acceptable for MVP
- No E2E test suite required

---

## 17. Deployment

- Public URL (not a local demo)
- Stack: Vercel (frontend/API) + Supabase (DB)
- Step 1: push to GitHub

---

## 18. Auth Decision

**Supabase Auth** — built-in email+password, handles sessions, cookies, token refresh, and RLS automatically. No custom JWT or sessions table. `profiles` table extends `auth.users` with display name.
