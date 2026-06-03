import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/groups/[id]/balances — all members' net balances in a group
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: groupId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('group_members').select('user_id')
    .eq('group_id', groupId).eq('user_id', user.id).single()
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: balances, error } = await supabase.rpc('get_group_balances', { p_group_id: groupId })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ balances: balances ?? [] })
}
