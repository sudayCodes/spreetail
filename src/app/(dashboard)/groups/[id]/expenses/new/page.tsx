import { notFound } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import NewExpenseForm from './NewExpenseForm'

export default async function NewExpensePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: groupId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const db = createAdminClient()

  const { data: membership } = await db
    .from('group_members').select('user_id')
    .eq('group_id', groupId).eq('user_id', user!.id).single()
  if (!membership) notFound()

  const { data: memberRows } = await db
    .from('group_members').select('user_id').eq('group_id', groupId)

  const memberIds = (memberRows ?? []).map(m => m.user_id)
  const { data: profiles } = memberIds.length
    ? await db.from('profiles').select('id, name').in('id', memberIds)
    : { data: [] }

  const members = (profiles ?? []).map(p => ({ id: p.id, name: p.name }))

  return (
    <div className="max-w-xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold mb-6">Add expense</h1>
      <NewExpenseForm groupId={groupId} members={members} currentUserId={user!.id} />
    </div>
  )
}
