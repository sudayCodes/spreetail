import { createClient, createAdminClient } from '@/lib/supabase/server'
import Link from 'next/link'
import CreateGroupButton from './CreateGroupButton'

export default async function GroupsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const db = createAdminClient()
  const { data: rows } = await db
    .from('group_members')
    .select('group_id')
    .eq('user_id', user!.id)

  const groupIds = (rows ?? []).map(r => r.group_id)

  const { data: groupsData } = groupIds.length
    ? await db.from('groups').select('id, name, type, created_at').in('id', groupIds)
    : { data: [] }

  const groups = (groupsData ?? []).filter(g => g.type === 'group')

  // Member counts
  const { data: memberCounts } = groupIds.length
    ? await db.from('group_members').select('group_id').in('group_id', groupIds)
    : { data: [] }

  const countMap: Record<string, number> = {}
  ;(memberCounts ?? []).forEach(m => {
    countMap[m.group_id] = (countMap[m.group_id] ?? 0) + 1
  })

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Groups</h1>
        <CreateGroupButton />
      </div>

      {groups.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg">No groups yet.</p>
          <p className="text-sm mt-1">Create one to start splitting expenses.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {groups.map(g => (
            <li key={g.id}>
              <Link
                href={`/groups/${g.id}`}
                className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-5 py-4 hover:border-indigo-300 hover:shadow-sm transition"
              >
                <div>
                  <p className="font-medium text-gray-900">{g.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{countMap[g.id] ?? 0} members</p>
                </div>
                <span className="text-gray-300">→</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
