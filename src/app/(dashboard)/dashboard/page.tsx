import { createClient, createAdminClient } from '@/lib/supabase/server'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const db = createAdminClient()
  const { data: memberships } = await db
    .from('group_members').select('group_id').eq('user_id', user!.id)
  const groupIds = (memberships ?? []).map(m => m.group_id)

  if (!groupIds.length) {
    return (
      <DashboardClient
        balances={[]} totalOwed={0} totalOwedToYou={0} net={0} recentActivity={[]}
      />
    )
  }

  // All heavy queries in parallel
  const [balanceResults, { data: groups }, { data: activity }] = await Promise.all([
    Promise.all(
      groupIds.map(gid =>
        db.rpc('get_user_group_balance', { p_group_id: gid, p_user_id: user!.id })
          .then(r => ({ group_id: gid, balance: r.data ?? 0 }))
      )
    ),
    db.from('groups').select('id, name, type').in('id', groupIds),
    db.from('activity_log').select('*').in('group_id', groupIds)
      .order('created_at', { ascending: false }).limit(10),
  ])

  const groupMap = Object.fromEntries((groups ?? []).map(g => [g.id, g]))
  const balances = balanceResults.map(b => ({
    ...b,
    name: groupMap[b.group_id]?.name ?? '',
    type: groupMap[b.group_id]?.type ?? 'group',
  }))

  const totalOwed = balances.filter(b => b.balance < 0).reduce((s, b) => s + Math.abs(b.balance), 0)
  const totalOwedToYou = balances.filter(b => b.balance > 0).reduce((s, b) => s + b.balance, 0)
  const net = totalOwedToYou - totalOwed

  return (
    <DashboardClient
      balances={balances}
      totalOwed={totalOwed}
      totalOwedToYou={totalOwedToYou}
      net={net}
      recentActivity={activity ?? []}
    />
  )
}
