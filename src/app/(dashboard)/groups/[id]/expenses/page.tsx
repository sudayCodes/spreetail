import { notFound } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import Link from 'next/link'
import type { ExpenseCategory } from '@/types/database'

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  food: 'bg-orange-100 text-orange-700',
  travel: 'bg-blue-100 text-blue-700',
  hotel: 'bg-purple-100 text-purple-700',
  entertainment: 'bg-pink-100 text-pink-700',
  other: 'bg-gray-100 text-gray-600',
}

export default async function GroupExpensesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: groupId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const db = createAdminClient()

  const { data: membership } = await db
    .from('group_members').select('user_id')
    .eq('group_id', groupId).eq('user_id', user!.id).single()
  if (!membership) notFound()

  const { data: group } = await db.from('groups').select('name').eq('id', groupId).single()

  const { data: expenses } = await db
    .from('expenses')
    .select('id, description, total_amount, category, paid_by, created_at')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })

  const paidByIds = [...new Set((expenses ?? []).map(e => e.paid_by))]
  const { data: profiles } = paidByIds.length
    ? await db.from('profiles').select('id, name').in('id', paidByIds)
    : { data: [] }
  const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p.name]))

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/groups/${groupId}`} className="text-sm text-gray-400 hover:text-gray-600">← {group?.name}</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-bold">All Expenses</h1>
      </div>

      {!expenses?.length ? (
        <div className="text-center py-20 text-gray-400">
          <p>No expenses yet.</p>
          <Link href={`/groups/${groupId}/expenses/new`} className="text-indigo-600 text-sm mt-2 inline-block hover:underline">
            Add the first one →
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {expenses.map(exp => (
            <li key={exp.id}>
              <Link
                href={`/groups/${groupId}/expenses/${exp.id}`}
                className="flex items-center gap-4 bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-indigo-300 transition"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{exp.description}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Paid by {profileMap[exp.paid_by] ?? 'someone'} · {new Date(exp.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${CATEGORY_COLORS[exp.category as ExpenseCategory]}`}>
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
