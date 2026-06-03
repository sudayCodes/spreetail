import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import NewExpenseForm from './NewExpenseForm'

export default async function NewExpensePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: groupId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: membership } = await supabase
    .from('group_members').select('user_id')
    .eq('group_id', groupId).eq('user_id', user!.id).single()

  if (!membership) notFound()

  const { data: memberRows } = await supabase
    .from('group_members')
    .select('user_id, profile:profiles(name)')
    .eq('group_id', groupId)

  const members = (memberRows ?? []).map(m => ({
    id: m.user_id,
    name: (m.profile as unknown as { name: string } | null)?.name ?? 'Unknown',
  }))

  return (
    <div className="max-w-xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold mb-6">Add expense</h1>
      <NewExpenseForm groupId={groupId} members={members} currentUserId={user!.id} />
    </div>
  )
}
