import { notFound } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import Link from 'next/link'
import SettleUpButton from '@/components/SettleUpButton'

export default async function ExpenseDetailPage({
  params,
}: {
  params: Promise<{ id: string; expenseId: string }>
}) {
  const { id: groupId, expenseId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const db = createAdminClient()

  const [
    { data: expense },
    { data: membership },
  ] = await Promise.all([
    db.from('expenses').select('*').eq('id', expenseId).single(),
    db.from('group_members').select('user_id').eq('group_id', groupId).eq('user_id', user!.id).single(),
  ])

  if (!expense || expense.group_id !== groupId) notFound()
  if (!membership) notFound()

  const [
    { data: splitRows },
    { data: paidByProfile },
  ] = await Promise.all([
    db.from('expense_splits').select('user_id, amount_owed').eq('expense_id', expenseId),
    db.from('profiles').select('name').eq('id', expense.paid_by).single(),
  ])

  const splitUserIds = [...new Set((splitRows ?? []).map(s => s.user_id))]
  const { data: splitProfiles } = splitUserIds.length
    ? await db.from('profiles').select('id, name').in('id', splitUserIds)
    : { data: [] }
  const splitProfileMap = Object.fromEntries((splitProfiles ?? []).map(p => [p.id, p.name]))

  const splits = (splitRows ?? []).map(s => ({
    user_id: s.user_id,
    name: splitProfileMap[s.user_id] ?? 'Unknown',
    amount_owed: s.amount_owed,
  }))

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div>
        <Link href={`/groups/${groupId}`} className="text-xs text-gray-400 hover:text-gray-600">← Back to group</Link>
        <h1 className="text-2xl font-bold mt-2">{expense.description}</h1>
        <p className="text-gray-400 text-sm mt-1">
          Paid by {paidByProfile?.name ?? 'someone'} · {expense.category} · {new Date(expense.created_at).toLocaleDateString()}
        </p>
      </div>

      <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-6 py-4">
        <p className="text-xs text-indigo-400 uppercase tracking-wide font-medium">Total</p>
        <p className="text-3xl font-bold text-indigo-700 mt-1">${(expense.total_amount / 100).toFixed(2)}</p>
        <p className="text-xs text-indigo-400 mt-1 capitalize">Split {expense.split_type}</p>
      </div>

      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Who owes what</h2>
        <div className="space-y-2">
          {splits.map(s => (
            <div key={s.user_id} className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3">
              <span className="text-sm font-medium">{s.name}</span>
              <span className="text-sm font-semibold text-gray-700">${(s.amount_owed / 100).toFixed(2)}</span>
            </div>
          ))}
        </div>
      </section>

      <p className="text-xs text-gray-400 text-center">
        Chat and settle up are available on the{' '}
        <Link href={`/groups/${groupId}`} className="text-indigo-500 hover:underline">group page</Link>.
      </p>

      <SettleUpButton groupId={groupId} />
    </div>
  )
}
