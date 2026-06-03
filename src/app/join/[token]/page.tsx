import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect(`/login?next=/join/${token}`)

  const db = createAdminClient()

  const { data: group } = await db
    .from('groups').select('id, name').eq('invite_token', token).single()

  if (!group) redirect('/dashboard')

  const { data: existing } = await db
    .from('group_members').select('user_id')
    .eq('group_id', group.id).eq('user_id', user.id).single()

  if (!existing) {
    await db.from('group_members').insert({ group_id: group.id, user_id: user.id })
    const { data: profile } = await db.from('profiles').select('name').eq('id', user.id).single()
    await db.from('activity_log').insert({
      group_id: group.id, actor_id: user.id,
      action_type: 'MEMBER_JOINED',
      description: `${profile?.name ?? 'Someone'} joined via invite link`,
    })
  }

  redirect(`/groups/${group.id}`)
}
