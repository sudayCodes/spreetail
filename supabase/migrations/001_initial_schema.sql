-- =============================================================
-- Spreetail — initial schema
-- All monetary amounts stored as INTEGER CENTS (e.g. $10.50 → 1050)
-- =============================================================

-- ─── profiles (extends auth.users) ───────────────────────────
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);

-- Auto-create profile row on new auth user
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── groups ──────────────────────────────────────────────────
create type public.group_type as enum ('direct', 'group');

create table public.groups (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  type         public.group_type not null default 'group',
  invite_token uuid not null unique default gen_random_uuid(),
  created_at   timestamptz not null default now()
);

-- ─── group_members ───────────────────────────────────────────
create table public.group_members (
  group_id  uuid not null references public.groups(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

-- ─── expenses ────────────────────────────────────────────────
create type public.split_type as enum ('equal', 'unequal', 'percentage', 'share');
create type public.expense_category as enum ('food', 'travel', 'hotel', 'entertainment', 'other');

create table public.expenses (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references public.groups(id) on delete cascade,
  paid_by      uuid not null references auth.users(id),
  description  text not null,
  total_amount integer not null check (total_amount > 0),
  split_type   public.split_type not null default 'equal',
  category     public.expense_category not null default 'other',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  updated_by   uuid references auth.users(id)
);

-- ─── expense_splits ──────────────────────────────────────────
create table public.expense_splits (
  id           uuid primary key default gen_random_uuid(),
  expense_id   uuid not null references public.expenses(id) on delete cascade,
  user_id      uuid not null references auth.users(id),
  amount_owed  integer not null check (amount_owed >= 0)
);

-- ─── settlements ─────────────────────────────────────────────
create table public.settlements (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups(id) on delete cascade,
  payer_id    uuid not null references auth.users(id),
  receiver_id uuid not null references auth.users(id),
  amount      integer not null check (amount > 0),
  created_at  timestamptz not null default now()
);

-- ─── messages ────────────────────────────────────────────────
create table public.messages (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups(id) on delete cascade,
  sender_id  uuid not null references auth.users(id),
  content    text not null,
  created_at timestamptz not null default now()
);

-- ─── activity_log ────────────────────────────────────────────
create table public.activity_log (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups(id) on delete cascade,
  actor_id    uuid not null references auth.users(id),
  action_type text not null,
  description text not null,
  created_at  timestamptz not null default now()
);

-- =============================================================
-- Row Level Security
-- =============================================================

alter table public.profiles      enable row level security;
alter table public.groups        enable row level security;
alter table public.group_members enable row level security;
alter table public.expenses      enable row level security;
alter table public.expense_splits enable row level security;
alter table public.settlements   enable row level security;
alter table public.messages      enable row level security;
alter table public.activity_log  enable row level security;

-- Helper: is current user a member of a group?
create or replace function public.is_group_member(gid uuid)
returns boolean language sql security definer as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = auth.uid()
  );
$$;

-- profiles: own row only
create policy "profiles: own row" on public.profiles
  for all using (id = auth.uid());

-- profiles: members can see each other
create policy "profiles: visible to group members" on public.profiles
  for select using (
    exists (
      select 1 from public.group_members gm1
      join public.group_members gm2 on gm1.group_id = gm2.group_id
      where gm1.user_id = auth.uid() and gm2.user_id = profiles.id
    )
  );

-- groups: members can see their groups
create policy "groups: member read" on public.groups
  for select using (public.is_group_member(id));

-- groups: any authenticated user can create
create policy "groups: authenticated create" on public.groups
  for insert with check (auth.uid() is not null);

-- group_members: members can see membership
create policy "group_members: member read" on public.group_members
  for select using (public.is_group_member(group_id));

-- group_members: authenticated users can insert (joining via invite)
create policy "group_members: insert" on public.group_members
  for insert with check (auth.uid() is not null);

-- group_members: member can remove themselves; others blocked at API level
create policy "group_members: delete self" on public.group_members
  for delete using (user_id = auth.uid() or public.is_group_member(group_id));

-- expenses: group members only
create policy "expenses: member access" on public.expenses
  for all using (public.is_group_member(group_id));

-- expense_splits: group members only (via expense)
create policy "expense_splits: member access" on public.expense_splits
  for all using (
    exists (
      select 1 from public.expenses e
      where e.id = expense_splits.expense_id
        and public.is_group_member(e.group_id)
    )
  );

-- settlements: group members only
create policy "settlements: member access" on public.settlements
  for all using (public.is_group_member(group_id));

-- messages: group members only
create policy "messages: member access" on public.messages
  for all using (public.is_group_member(group_id));

-- activity_log: group members only (read); insert via service role only
create policy "activity_log: member read" on public.activity_log
  for select using (public.is_group_member(group_id));

create policy "activity_log: service insert" on public.activity_log
  for insert with check (auth.uid() is not null);

-- =============================================================
-- Indexes for common queries
-- =============================================================
create index on public.group_members (user_id);
create index on public.expenses (group_id, created_at desc);
create index on public.expense_splits (expense_id);
create index on public.expense_splits (user_id);
create index on public.settlements (group_id);
create index on public.messages (group_id, created_at asc);
create index on public.activity_log (group_id, created_at desc);
