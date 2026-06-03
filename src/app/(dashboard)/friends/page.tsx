import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import AddFriendButton from './AddFriendButton'

export default async function FriendsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Friends = groups with type='direct' that the user belongs to
  const { data: rows } = await supabase
    .from('group_members')
    .select('group_id, group:groups!inner(id, name, type, invite_token)')
    .eq('user_id', user!.id)

  type GroupRow = { id: string; name: string; type: string; invite_token: string }
  const directGroups = (rows ?? [])
    .map(r => (r.group as unknown as GroupRow | null))
    .filter((g): g is GroupRow => g !== null && g.type === 'direct')

  // For each direct group, get the other member's profile
  const friendData = await Promise.all(
    directGroups.map(async g => {
      const { data: otherMember } = await supabase
        .from('group_members')
        .select('user_id, profile:profiles(name)')
        .eq('group_id', g.id)
        .neq('user_id', user!.id)
        .single()

      const balance = await supabase
        .rpc('get_user_group_balance', { p_group_id: g.id, p_user_id: user!.id })

      return {
        group_id: g.id,
        name: (otherMember?.profile as unknown as ({ name: string } | null))?.name ?? g.name,
        balance: balance.data ?? 0,
      }
    })
  )

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Friends</h1>
        <AddFriendButton />
      </div>

      {friendData.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg">No friends added yet.</p>
          <p className="text-sm mt-1">Add a friend to split expenses 1-on-1.</p>
        </div>
      ) : (
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
      )}
    </div>
  )
}
