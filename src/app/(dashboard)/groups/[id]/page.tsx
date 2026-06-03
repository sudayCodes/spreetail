import { notFound } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import Link from 'next/link'
import InvitePanel from './InvitePanel'
import MemberList from './MemberList'

export default async function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const db = createAdminClient()

  const { data: group } = await db.from('groups').select('*').eq('id', id).single()
  if (!group) notFound()

  const { data: membership } = await db
    .from('group_members').select('user_id')
    .eq('group_id', id).eq('user_id', user!.id).single()
  if (!membership) notFound()

  const { data: memberRows } = await db
    .from('group_members').select('user_id, joined_at').eq('group_id', id)

  const memberIds = (memberRows ?? []).map(m => m.user_id)
  const { data: profileRows } = memberIds.length
    ? await db.from('profiles').select('id, name').in('id', memberIds)
    : { data: [] }

  const profileMap = Object.fromEntries((profileRows ?? []).map(p => [p.id, p.name]))

  const members = (memberRows ?? []).map(m => ({
    user_id: m.user_id,
    name: profileMap[m.user_id] ?? 'Unknown',
    joined_at: m.joined_at,
  }))

  const { data: expenses } = await db
    .from('expenses').select('id, description, total_amount, category, paid_by, created_at')
    .eq('group_id', id).order('created_at', { ascending: false }).limit(10)

  const { data: balances } = await db.rpc('get_group_balances', { p_group_id: id })

  const { data: settlements } = await db
    .from('settlements').select('id, payer_id, receiver_id, amount, created_at')
    .eq('group_id', id).order('created_at', { ascending: false }).limit(20)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const inviteUrl = `${appUrl}/join/${group.invite_token}`

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{group.name}</h1>
          <p className="text-sm text-gray-400 mt-0.5">{members.length} members</p>
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
          {(balances ?? []).map((b: { user_id: string; name: string; balance: number }) => {
            const settled = b.balance === 0
            return (
              <div
                key={b.user_id}
                className={`border rounded-xl px-4 py-3 ${settled ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-200'}`}
              >
                <p className="text-sm font-medium text-gray-700 truncate">{b.name}</p>
                {settled ? (
                  <span className="inline-block mt-1 text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                    Settled ✓
                  </span>
                ) : (
                  <p className={`text-base font-bold mt-1 ${b.balance > 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {b.balance > 0 ? '+' : '-'}${(Math.abs(b.balance) / 100).toFixed(2)}
                  </p>
                )}
              </div>
            )
          })}
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
            {expenses.map(exp => (
              <li key={exp.id}>
                <Link
                  href={`/groups/${id}/expenses/${exp.id}`}
                  className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-indigo-300 transition"
                >
                  <div>
                    <p className="text-sm font-medium">{exp.description}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Paid by {profileMap[exp.paid_by] ?? 'someone'} · {exp.category}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-gray-700">
                    ${(exp.total_amount / 100).toFixed(2)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Members */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Members</h2>
        <MemberList groupId={id} currentUserId={user!.id} members={members} />
      </section>

      {/* Settlement history */}
      {settlements && settlements.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Payment history</h2>
          <ul className="space-y-2">
            {settlements.map(s => (
              <li key={s.id} className="flex items-center justify-between bg-white border border-gray-100 rounded-xl px-4 py-3">
                <div>
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">{profileMap[s.payer_id] ?? 'Someone'}</span>
                    {' paid '}
                    <span className="font-medium">{profileMap[s.receiver_id] ?? 'someone'}</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{new Date(s.created_at).toLocaleDateString()}</p>
                </div>
                <span className="text-sm font-semibold text-green-600">
                  ${(s.amount / 100).toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Invite */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Invite people</h2>
        <InvitePanel groupId={id} inviteUrl={inviteUrl} />
      </section>
    </div>
  )
}
