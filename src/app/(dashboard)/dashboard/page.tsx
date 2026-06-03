import { getAuthUser, createAdminClient } from '@/lib/supabase/server'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const user = await getAuthUser()

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

  // Single RPC call for all group balances + groups + activity in parallel
  const [{ data: allBalances }, { data: groups }, { data: activity }] = await Promise.all([
    db.rpc('get_all_user_balances', { p_user_id: user!.id }),
    db.from('groups').select('id, name, type').in('id', groupIds),
    db.from('activity_log').select('*').in('group_id', groupIds)
      .order('created_at', { ascending: false }).limit(10),
  ])

  const groupMap = Object.fromEntries((groups ?? []).map(g => [g.id, g]))
  const balances = (allBalances ?? []).map(b => ({
    group_id: b.group_id,
    balance: b.balance,
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
