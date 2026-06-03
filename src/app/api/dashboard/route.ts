import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createAdminClient()
  const { data: memberships } = await db
    .from('group_members').select('group_id').eq('user_id', user.id)
  const groupIds = (memberships ?? []).map(m => m.group_id)

  if (!groupIds.length) {
    return NextResponse.json({ balances: [], total_owed: 0, total_owed_to_you: 0, net: 0 })
  }

  const balanceResults = await Promise.all(
    groupIds.map(gid =>
      db.rpc('get_user_group_balance', { p_group_id: gid, p_user_id: user.id })
        .then(r => ({ group_id: gid, balance: r.data ?? 0 }))
    )
  )

  const { data: groups } = await db.from('groups').select('id, name, type').in('id', groupIds)
  const groupMap = Object.fromEntries((groups ?? []).map(g => [g.id, g]))

  const balances = balanceResults.map(b => ({
    ...b,
    name: groupMap[b.group_id]?.name ?? '',
    type: groupMap[b.group_id]?.type ?? 'group',
  }))

  const total_owed = balances.filter(b => b.balance < 0).reduce((s, b) => s + Math.abs(b.balance), 0)
  const total_owed_to_you = balances.filter(b => b.balance > 0).reduce((s, b) => s + b.balance, 0)
  const net = total_owed_to_you - total_owed

  return NextResponse.json({ balances, total_owed, total_owed_to_you, net })
}
