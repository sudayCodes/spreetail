import { createClient } from '@/lib/supabase/server'

const ACTION_ICONS: Record<string, string> = {
  CREATED_EXPENSE: '💸',
  EDITED_EXPENSE: '✏️',
  RECORDED_SETTLEMENT: '✅',
  MEMBER_JOINED: '👋',
  MEMBER_ADDED: '➕',
  CREATED_GROUP: '🎉',
}

export default async function ActivityPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: memberships } = await supabase
    .from('group_members').select('group_id').eq('user_id', user!.id)
  const groupIds = (memberships ?? []).map(m => m.group_id)

  const { data: activity } = groupIds.length
    ? await supabase
        .from('activity_log')
        .select('*')
        .in('group_id', groupIds)
        .order('created_at', { ascending: false })
        .limit(100)
    : { data: [] }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold mb-6">Activity</h1>

      {!activity?.length ? (
        <div className="text-center py-20 text-gray-400">
          <p>No activity yet. Add an expense to get started.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {activity.map(a => (
            <li key={a.id} className="flex items-start gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3">
              <span className="text-lg shrink-0">{ACTION_ICONS[a.action_type] ?? '•'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700">{a.description}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(a.created_at).toLocaleString()}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
