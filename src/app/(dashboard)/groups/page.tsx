import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import CreateGroupButton from './CreateGroupButton'

export default async function GroupsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: rows } = await supabase
    .from('group_members')
    .select('group:groups(id, name, type, created_at, group_members(count))')
    .eq('user_id', user!.id)

  const groups = (rows ?? [])
    .map(r => (r as unknown as { group: { id: string; name: string; type: string; created_at: string; group_members: { count: number }[] } | null }).group)
    .filter((g): g is NonNullable<typeof g> => g !== null && g.type === 'group')

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
                  <p className="text-xs text-gray-400 mt-0.5">
                    {g.group_members?.[0]?.count ?? 0} members
                  </p>
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
