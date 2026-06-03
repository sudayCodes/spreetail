import { getAuthUser, createAdminClient } from '@/lib/supabase/server'
import Link from 'next/link'
import AddFriendButton from './AddFriendButton'

export default async function FriendsPage() {
  const user = await getAuthUser()

  const db = createAdminClient()
  const { data: rows } = await db
    .from('group_members').select('group_id').eq('user_id', user!.id)
  const groupIds = (rows ?? []).map(r => r.group_id)

  const { data: directGroups } = groupIds.length
    ? await db.from('groups').select('id, name').eq('type', 'direct').in('id', groupIds)
    : { data: [] }

  const directGroupIds = (directGroups ?? []).map(g => g.id)

  if (!directGroupIds.length) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Friends</h1>
          <AddFriendButton />
        </div>
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg">No friends added yet.</p>
          <p className="text-sm mt-1">Add a friend to split expenses 1-on-1.</p>
        </div>
      </div>
    )
  }

  // Step 1: other member IDs + all balances in parallel (was 3×N sequential calls)
  const [{ data: otherMembers }, { data: allBalances }] = await Promise.all([
    db.from('group_members').select('group_id, user_id')
      .in('group_id', directGroupIds).neq('user_id', user!.id),
    db.rpc('get_all_user_balances', { p_user_id: user!.id }),
  ])

  // Step 2: batch profile fetch for all other members at once
  const otherUserIds = [...new Set((otherMembers ?? []).map(m => m.user_id))]
  const { data: profiles } = otherUserIds.length
    ? await db.from('profiles').select('id, name').in('id', otherUserIds)
    : { data: [] }

  const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p.name]))
  const memberMap = Object.fromEntries((otherMembers ?? []).map(m => [m.group_id, m.user_id]))
  const balanceMap = Object.fromEntries((allBalances ?? []).map(b => [b.group_id, b.balance]))

  const friendData = (directGroups ?? []).map(g => {
    const otherUserId = memberMap[g.id]
    return {
      group_id: g.id,
      name: profileMap[otherUserId] ?? g.name,
      balance: balanceMap[g.id] ?? 0,
    }
  })

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Friends</h1>
        <AddFriendButton />
      </div>

      <ul className="space-y-2">
        {friendData.map(f => (
          <li key={f.group_id}>
            <Link
              href={`/groups/${f.group_id}`}
              className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-5 py-4 hover:border-indigo-300 hover:shadow-sm transition"
            >
              <p className="font-medium text-gray-900">{f.name}</p>
              <span className={`text-sm font-bold ${f.balance >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {f.balance === 0 ? 'settled' : `${f.balance >= 0 ? '+' : '-'}$${(Math.abs(f.balance) / 100).toFixed(2)}`}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
