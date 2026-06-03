-- Pairwise net debt: exactly what p_user_id owes each other member in the group.
--
-- Formula per (p_user → creditor) pair:
--   + expense_splits WHERE user_id=p_user AND expense.paid_by=creditor   (p_user's shares on creditor-paid expenses)
--   - expense_splits WHERE user_id=creditor AND expense.paid_by=p_user   (creditor's shares on p_user-paid expenses — offsets)
--   - settlements WHERE payer=p_user AND receiver=creditor                (p_user already paid creditor)
--   + settlements WHERE payer=creditor AND receiver=p_user                (creditor paid p_user — offsets the credit above)
--
-- Only returns rows where net_owed > 0 (p_user genuinely owes that person).
-- Run in Supabase SQL Editor after 003_realtime.sql.

create or replace function public.get_pairwise_debts(p_group_id uuid, p_user_id uuid)
returns table (creditor_id uuid, creditor_name text, net_owed integer)
language sql security definer as $$
  with
  -- Shares p_user owes on expenses paid by others
  expense_debts as (
    select
      e.paid_by                      as creditor_id,
      sum(es.amount_owed)::integer   as amount
    from public.expense_splits es
    join public.expenses e on e.id = es.expense_id
    where e.group_id  = p_group_id
      and es.user_id  = p_user_id
      and e.paid_by  <> p_user_id
    group by e.paid_by
  ),
  -- Shares others owe p_user on expenses p_user paid (credits that offset)
  expense_credits as (
    select
      es.user_id                     as creditor_id,
      sum(es.amount_owed)::integer   as amount
    from public.expense_splits es
    join public.expenses e on e.id = es.expense_id
    where e.group_id  = p_group_id
      and e.paid_by   = p_user_id
      and es.user_id <> p_user_id
    group by es.user_id
  ),
  -- Settlements p_user already sent (reduces debt)
  paid_out as (
    select receiver_id as creditor_id, sum(amount)::integer as amount
    from public.settlements
    where group_id = p_group_id and payer_id = p_user_id
    group by receiver_id
  ),
  -- Settlements others sent to p_user (creditor paying their own debt back to p_user)
  received_from as (
    select payer_id as creditor_id, sum(amount)::integer as amount
    from public.settlements
    where group_id = p_group_id and receiver_id = p_user_id
    group by payer_id
  ),
  -- Union of all people p_user has any financial relationship with
  candidates as (
    select creditor_id from expense_debts
    union
    select creditor_id from expense_credits
    union
    select creditor_id from paid_out
    union
    select creditor_id from received_from
  )
  select
    c.creditor_id,
    p.name as creditor_name,
    (
        coalesce(ed.amount, 0)
      - coalesce(ec.amount, 0)
      - coalesce(po.amount, 0)
      + coalesce(rf.amount, 0)
    )::integer as net_owed
  from candidates c
  join public.profiles p on p.id = c.creditor_id
  left join expense_debts   ed on ed.creditor_id = c.creditor_id
  left join expense_credits ec on ec.creditor_id = c.creditor_id
  left join paid_out        po on po.creditor_id = c.creditor_id
  left join received_from   rf on rf.creditor_id = c.creditor_id
  where (
      coalesce(ed.amount, 0)
    - coalesce(ec.amount, 0)
    - coalesce(po.amount, 0)
    + coalesce(rf.amount, 0)
  ) > 0;
$$;
