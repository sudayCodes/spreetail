-- All group balances for a user in a single query.
-- Replaces N individual get_user_group_balance() calls on the dashboard/friends page.
-- Run in Supabase SQL Editor after 004_pairwise_debts.sql.

create or replace function public.get_all_user_balances(p_user_id uuid)
returns table (group_id uuid, balance integer)
language sql security definer as $$
  with
  my_groups as (
    select group_id from public.group_members where user_id = p_user_id
  ),
  fronted as (
    select group_id, sum(total_amount)::integer as amount
    from public.expenses
    where paid_by = p_user_id
      and group_id in (select group_id from my_groups)
    group by group_id
  ),
  owed as (
    select e.group_id, sum(es.amount_owed)::integer as amount
    from public.expense_splits es
    join public.expenses e on e.id = es.expense_id
    where es.user_id = p_user_id
      and e.group_id in (select group_id from my_groups)
    group by e.group_id
  ),
  sent as (
    select group_id, sum(amount)::integer as amount
    from public.settlements
    where payer_id = p_user_id
      and group_id in (select group_id from my_groups)
    group by group_id
  ),
  received as (
    select group_id, sum(amount)::integer as amount
    from public.settlements
    where receiver_id = p_user_id
      and group_id in (select group_id from my_groups)
    group by group_id
  )
  select
    mg.group_id,
    (
      coalesce(f.amount, 0)
      - coalesce(o.amount, 0)
      + coalesce(s.amount, 0)
      - coalesce(r.amount, 0)
    )::integer as balance
  from my_groups mg
  left join fronted  f on f.group_id = mg.group_id
  left join owed     o on o.group_id = mg.group_id
  left join sent     s on s.group_id = mg.group_id
  left join received r on r.group_id = mg.group_id;
$$;
