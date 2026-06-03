import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/groups/[id]/members — add member by email
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: groupId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify requester is a member
  const { data: membership } = await supabase
    .from('group_members')
    .select('user_id')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .single()

  if (!membership) return NextResponse.json({ error: 'Not a group member' }, { status: 403 })

  const { email } = await request.json()
  if (!email?.trim()) return NextResponse.json({ error: 'Email required' }, { status: 400 })

  // Look up auth user id by email
  const { data: authUserId } = await supabase.rpc('get_user_id_by_email', {
    p_email: email.trim().toLowerCase(),
  })

  if (!authUserId) {
    return NextResponse.json({ error: 'No user found with that email' }, { status: 404 })
  }

  const { data: targetUser, error: lookupErr } = await supabase
    .from('profiles')
    .select('id, name')
    .eq('id', authUserId)
    .single()

  if (lookupErr || !targetUser) {
    return NextResponse.json({ error: 'No user found with that email' }, { status: 404 })
  }

  // Check not already a member
  const { data: existing } = await supabase
    .from('group_members')
    .select('user_id')
    .eq('group_id', groupId)
    .eq('user_id', targetUser.id)
    .single()

  if (existing) return NextResponse.json({ error: 'Already a member' }, { status: 409 })

  const { error: insertErr } = await supabase
    .from('group_members')
    .insert({ group_id: groupId, user_id: targetUser.id })

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

  const { data: actorProfile } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', user.id)
    .single()

  await supabase.from('activity_log').insert({
    group_id: groupId,
    actor_id: user.id,
    action_type: 'MEMBER_ADDED',
    description: `${actorProfile?.name ?? 'Someone'} added ${targetUser.name} to the group`,
  })

  return NextResponse.json({ member: targetUser }, { status: 201 })
}

// DELETE /api/groups/[id]/members?userId=xxx — remove a member
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: groupId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const targetUserId = searchParams.get('userId') ?? user.id

  // Verify requester is a member
  const { data: membership } = await supabase
    .from('group_members')
    .select('user_id')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .single()

  if (!membership) return NextResponse.json({ error: 'Not a group member' }, { status: 403 })

  // Block removal if target has unpaid debts in this group
  const { data: balanceData } = await supabase.rpc('get_user_group_balance', {
    p_group_id: groupId,
    p_user_id: targetUserId,
  })

  if (balanceData !== null && balanceData !== 0) {
    return NextResponse.json(
      { error: 'Cannot remove member with unsettled balance' },
      { status: 422 }
    )
  }

  await supabase
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', targetUserId)

  return NextResponse.json({ ok: true })
}
