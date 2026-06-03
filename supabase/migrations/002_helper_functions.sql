-- Look up auth.users.id by email (used by add-member-by-email API)
create or replace function public.get_user_id_by_email(p_email text)
returns uuid language sql security definer as $$
  select id from auth.users where lower(email) = lower(p_email) limit 1;
$$;

-- Net balance for a user in a group (returns integer cents)
-- Positive = others owe user | Negative = user owes others
create or replace function public.get_user_group_balance(p_group_id uuid, p_user_id uuid)
returns integer language sql security definer as $$
  select
    coalesce(
      (select sum(e.total_amount)
       from public.expenses e
       where e.group_id = p_group_id and e.paid_by = p_user_id), 0
    )
    -
    coalesce(
      (select sum(es.amount_owed)
       from public.expense_splits es
       join public.expenses e on e.id = es.expense_id
       where e.group_id = p_group_id and es.user_id = p_user_id), 0
    )
    +
    coalesce(
      (select sum(amount) from public.settlements
       where group_id = p_group_id and payer_id = p_user_id), 0
    )
    -
    coalesce(
      (select sum(amount) from public.settlements
       where group_id = p_group_id and receiver_id = p_user_id), 0
    );
$$;

-- All members' balances for a group
create or replace function public.get_group_balances(p_group_id uuid)
returns table (user_id uuid, name text, balance integer) language sql security definer as $$
  select
    p.id as user_id,
    p.name,
    public.get_user_group_balance(p_group_id, p.id) as balance
  from public.group_members gm
  join public.profiles p on p.id = gm.user_id
  where gm.group_id = p_group_id;
$$;
