import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import type { ExpenseCategory } from '@/types/database'

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  food: 'bg-orange-100 text-orange-700',
  travel: 'bg-blue-100 text-blue-700',
  hotel: 'bg-purple-100 text-purple-700',
  entertainment: 'bg-pink-100 text-pink-700',
  other: 'bg-gray-100 text-gray-600',
}

export default async function AllExpensesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: memberships } = await supabase
    .from('group_members').select('group_id').eq('user_id', user!.id)
  const groupIds = (memberships ?? []).map(m => m.group_id)

  const { data: expenses } = groupIds.length
    ? await supabase
        .from('expenses')
        .select('id, description, total_amount, category, group_id, created_at')
        .in('group_id', groupIds)
        .order('created_at', { ascending: false })
        .limit(50)
    : { data: [] }

  const { data: groups } = groupIds.length
    ? await supabase.from('groups').select('id, name').in('id', groupIds)
    : { data: [] }

  const groupMap = Object.fromEntries((groups ?? []).map(g => [g.id, g.name]))

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold mb-6">All Expenses</h1>

      {!expenses?.length ? (
        <div className="text-center py-20 text-gray-400">
          <p>No expenses yet across any group.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {expenses.map(exp => (
            <li key={exp.id}>
              <Link
                href={`/groups/${exp.group_id}/expenses/${exp.id}`}
                className="flex items-center gap-4 bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-indigo-300 transition"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{exp.description}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{groupMap[exp.group_id] ?? ''} · {new Date(exp.created_at).toLocaleDateString()}</p>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${CATEGORY_COLORS[exp.category as ExpenseCategory]}`}>
                  {exp.category}
                </span>
                <span className="text-sm font-semibold text-gray-700 shrink-0">
                  ${(exp.total_amount / 100).toFixed(2)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
