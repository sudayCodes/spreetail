import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import InvitePanel from './InvitePanel'
import MemberList from './MemberList'

export default async function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: group } = await supabase
    .from('groups')
    .select('*')
    .eq('id', id)
    .single()

  if (!group) notFound()

  // Verify current user is a member
  const { data: membership } = await supabase
    .from('group_members')
    .select('user_id')
    .eq('group_id', id)
    .eq('user_id', user!.id)
    .single()

  if (!membership) notFound()

  // Members with profiles
  const { data: members } = await supabase
    .from('group_members')
    .select('user_id, joined_at, profile:profiles(name)')
    .eq('group_id', id)

  // Recent expenses (last 10)
  const { data: expenses } = await supabase
    .from('expenses')
    .select('id, description, total_amount, category, paid_by, created_at, paid_by_profile:profiles!expenses_paid_by_fkey(name)')
    .eq('group_id', id)
    .order('created_at', { ascending: false })
    .limit(10)

  // Group balances
  const { data: balances } = await supabase.rpc('get_group_balances', { p_group_id: id })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const inviteUrl = `${appUrl}/join/${group.invite_token}`

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{group.name}</h1>
          <p className="text-sm text-gray-400 mt-0.5">{members?.length ?? 0} members</p>
        </div>
        <Link
          href={`/groups/${id}/expenses/new`}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          + Add expense
        </Link>
      </div>

      {/* Balances */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Balances</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {(balances ?? []).map((b: { user_id: string; name: string; balance: number }) => (
            <div key={b.user_id} className="bg-white border border-gray-200 rounded-xl px-4 py-3">
              <p className="text-sm font-medium text-gray-700 truncate">{b.name}</p>
              <p className={`text-base font-bold mt-1 ${b.balance >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {b.balance >= 0 ? '+' : '-'}${(Math.abs(b.balance) / 100).toFixed(2)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Recent expenses */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Recent Expenses</h2>
          <Link href={`/groups/${id}/expenses`} className="text-xs text-indigo-600 hover:underline">View all</Link>
        </div>
        {!expenses?.length ? (
          <p className="text-sm text-gray-400">No expenses yet. Add the first one!</p>
        ) : (
          <ul className="space-y-2">
            {expenses.map(exp => {
              const paidByProfile = exp.paid_by_profile as unknown as { name: string } | null
              return (
                <li key={exp.id}>
                  <Link
                    href={`/groups/${id}/expenses/${exp.id}`}
                    className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-indigo-300 transition"
                  >
                    <div>
                      <p className="text-sm font-medium">{exp.description}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Paid by {paidByProfile?.name ?? 'someone'} · {exp.category}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-gray-700">
                      ${(exp.total_amount / 100).toFixed(2)}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* Members */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Members</h2>
        <MemberList
          groupId={id}
          currentUserId={user!.id}
          members={(members ?? []).map(m => ({
            user_id: m.user_id,
            name: (m.profile as unknown as ({ name: string } | null))?.name ?? 'Unknown',
            joined_at: m.joined_at,
          }))}
        />
      </section>

      {/* Invite */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Invite people</h2>
        <InvitePanel groupId={id} inviteUrl={inviteUrl} />
      </section>
    </div>
  )
}
