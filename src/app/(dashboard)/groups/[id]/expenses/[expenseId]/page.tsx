import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import GroupChat from '@/components/GroupChat'
import SettleUpButton from '@/components/SettleUpButton'

export default async function ExpenseDetailPage({
  params,
}: {
  params: Promise<{ id: string; expenseId: string }>
}) {
  const { id: groupId, expenseId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: expense } = await supabase
    .from('expenses')
    .select('*')
    .eq('id', expenseId)
    .single()

  if (!expense || expense.group_id !== groupId) notFound()

  const { data: membership } = await supabase
    .from('group_members').select('user_id')
    .eq('group_id', groupId).eq('user_id', user!.id).single()
  if (!membership) notFound()

  const { data: splitRows } = await supabase
    .from('expense_splits')
    .select('*, profile:profiles(name)')
    .eq('expense_id', expenseId)

  const { data: paidByProfile } = await supabase
    .from('profiles').select('name').eq('id', expense.paid_by).single()

  const { data: initialMessages } = await supabase
    .from('messages')
    .select('*, sender:profiles(name)')
    .eq('group_id', groupId)
    .order('created_at', { ascending: true })
    .limit(100)

  const splits = (splitRows ?? []).map(s => ({
    user_id: s.user_id,
    name: (s.profile as unknown as ({ name: string } | null))?.name ?? 'Unknown',
    amount_owed: s.amount_owed,
  }))

  const msgs = (initialMessages ?? []).map(m => ({
    id: m.id,
    sender_id: m.sender_id,
    sender_name: (m.sender as unknown as ({ name: string } | null))?.name ?? 'Unknown',
    content: m.content,
    created_at: m.created_at,
  }))

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">
      {/* Header */}
      <div>
        <Link href={`/groups/${groupId}`} className="text-xs text-gray-400 hover:text-gray-600">← Back to group</Link>
        <h1 className="text-2xl font-bold mt-2">{expense.description}</h1>
        <p className="text-gray-400 text-sm mt-1">
          Paid by {paidByProfile?.name ?? 'someone'} · {expense.category} · {new Date(expense.created_at).toLocaleDateString()}
        </p>
      </div>

      {/* Amount */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-6 py-4">
        <p className="text-xs text-indigo-400 uppercase tracking-wide font-medium">Total</p>
        <p className="text-3xl font-bold text-indigo-700 mt-1">
          ${(expense.total_amount / 100).toFixed(2)}
        </p>
        <p className="text-xs text-indigo-400 mt-1 capitalize">Split {expense.split_type}</p>
      </div>

      {/* Splits */}
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

      {/* Settle up */}
      <SettleUpButton groupId={groupId} />

      {/* Real-time group chat */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Group chat</h2>
        <GroupChat
          groupId={groupId}
          currentUserId={user!.id}
          initialMessages={msgs}
        />
      </section>
    </div>
  )
}
