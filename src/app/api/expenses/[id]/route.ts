import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { calculateSplits, dollarsToCents } from '@/lib/balance'
import type { SplitType, ExpenseCategory } from '@/types/database'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createAdminClient()
  const { data: expense, error } = await db.from('expenses').select('*').eq('id', id).single()
  if (error || !expense) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: splits } = await db.from('expense_splits').select('*').eq('expense_id', id)
  return NextResponse.json({ expense, splits: splits ?? [] })
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createAdminClient()
  const { data: expense } = await db.from('expenses').select('*').eq('id', id).single()
  if (!expense) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: membership } = await db
    .from('group_members').select('user_id')
    .eq('group_id', expense.group_id).eq('user_id', user.id).single()
  if (!membership) return NextResponse.json({ error: 'Not a member' }, { status: 403 })

  const body = await request.json()
  const {
    description,
    amount,
    split_type = expense.split_type as SplitType,
    category = expense.category as ExpenseCategory,
    paid_by = expense.paid_by,
    member_ids,
    split_values = {} as Record<string, number>,
  } = body

  const totalCents = amount ? dollarsToCents(amount) : expense.total_amount

  const { data: updated, error: updateErr } = await db
    .from('expenses')
    .update({
      description: description?.trim() ?? expense.description,
      total_amount: totalCents, split_type, category, paid_by,
      updated_at: new Date().toISOString(), updated_by: user.id,
    })
    .eq('id', id).select().single()

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  if (member_ids?.length) {
    await db.from('expense_splits').delete().eq('expense_id', id)
    const splits = calculateSplits(totalCents, member_ids, split_type, split_values)
    await db.from('expense_splits').insert(
      Object.entries(splits).map(([userId, amountOwed]) => ({
        expense_id: id, user_id: userId, amount_owed: amountOwed,
      }))
    )
  }

  const { data: actorProfile } = await db.from('profiles').select('name').eq('id', user.id).single()
  await db.from('activity_log').insert({
    group_id: expense.group_id, actor_id: user.id,
    action_type: 'EDITED_EXPENSE',
    description: `${actorProfile?.name ?? 'Someone'} edited "${updated.description}"`,
  })

  return NextResponse.json({ expense: updated })
}
