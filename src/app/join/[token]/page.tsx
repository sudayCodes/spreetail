import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/login?next=/join/${token}`)
  }

  const { data: group } = await supabase
    .from('groups')
    .select('id, name')
    .eq('invite_token', token)
    .single()

  if (!group) {
    redirect('/dashboard')
  }

  // Already a member?
  const { data: existing } = await supabase
    .from('group_members')
    .select('user_id')
    .eq('group_id', group.id)
    .eq('user_id', user.id)
    .single()

  if (!existing) {
    await supabase.from('group_members').insert({ group_id: group.id, user_id: user.id })

    const { data: profile } = await supabase.from('profiles').select('name').eq('id', user.id).single()
    await supabase.from('activity_log').insert({
      group_id: group.id,
      actor_id: user.id,
      action_type: 'MEMBER_JOINED',
      description: `${profile?.name ?? 'Someone'} joined via invite link`,
    })
  }

  redirect(`/groups/${group.id}`)
}
