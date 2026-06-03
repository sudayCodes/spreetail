import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { calculateSplits, dollarsToCents } from '@/lib/balance'
import type { SplitType, ExpenseCategory } from '@/types/database'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: groupId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createAdminClient()
  const { data, error } = await db
    .from('expenses')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ expenses: data ?? [] })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: groupId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createAdminClient()

  const { data: membership } = await db
    .from('group_members').select('user_id')
    .eq('group_id', groupId).eq('user_id', user.id).single()
  if (!membership) return NextResponse.json({ error: 'Not a member' }, { status: 403 })

  const body = await request.json()
  const {
    description,
    amount,
    split_type = 'equal' as SplitType,
    category = 'other' as ExpenseCategory,
    paid_by = user.id,
    member_ids,
    split_values = {} as Record<string, number>,
  } = body

  if (!description?.trim()) return NextResponse.json({ error: 'Description required' }, { status: 400 })
  if (!amount || isNaN(parseFloat(amount))) return NextResponse.json({ error: 'Valid amount required' }, { status: 400 })
  if (!member_ids?.length) return NextResponse.json({ error: 'At least one member required' }, { status: 400 })

  const totalCents = dollarsToCents(amount)
  const splits = calculateSplits(totalCents, member_ids, split_type, split_values)

  const { data: expense, error: expErr } = await db
    .from('expenses')
    .insert({ group_id: groupId, paid_by, description: description.trim(), total_amount: totalCents, split_type, category })
    .select().single()

  if (expErr) return NextResponse.json({ error: expErr.message }, { status: 500 })

  const splitRows = Object.entries(splits).map(([userId, amountOwed]) => ({
    expense_id: expense.id, user_id: userId, amount_owed: amountOwed,
  }))
  const { error: splitErr } = await db.from('expense_splits').insert(splitRows)
  if (splitErr) return NextResponse.json({ error: splitErr.message }, { status: 500 })

  const { data: actorProfile } = await db.from('profiles').select('name').eq('id', user.id).single()
  await db.from('activity_log').insert({
    group_id: groupId, actor_id: user.id,
    action_type: 'CREATED_EXPENSE',
    description: `${actorProfile?.name ?? 'Someone'} added "$${(totalCents / 100).toFixed(2)} ${description.trim()}"`,
  })

  return NextResponse.json({ expense }, { status: 201 })
}
