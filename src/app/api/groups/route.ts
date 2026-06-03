import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createAdminClient()
  const { data, error } = await db
    .from('group_members')
    .select('group:groups(id, name, type, invite_token, created_at, group_members(count))')
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const groups = data?.map(r => (r as unknown as { group: unknown }).group).filter(Boolean) ?? []
  return NextResponse.json({ groups })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, type = 'group' } = await request.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  const db = createAdminClient()

  const { data: group, error: gErr } = await db
    .from('groups')
    .insert({ name: name.trim(), type })
    .select()
    .single()

  if (gErr) return NextResponse.json({ error: gErr.message }, { status: 500 })

  const { error: mErr } = await db
    .from('group_members')
    .insert({ group_id: group.id, user_id: user.id })

  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 })

  await db.from('activity_log').insert({
    group_id: group.id,
    actor_id: user.id,
    action_type: 'CREATED_GROUP',
    description: `${user.email} created group "${group.name}"`,
  })

  return NextResponse.json({ group }, { status: 201 })
}
