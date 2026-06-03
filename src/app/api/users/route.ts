import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// GET /api/users?email=xxx — check if a user exists by email
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const email = new URL(request.url).searchParams.get('email')?.trim().toLowerCase()
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

  const db = createAdminClient()
  const { data: userId } = await db.rpc('get_user_id_by_email', { p_email: email })
  if (!userId) return NextResponse.json({ exists: false }, { status: 404 })

  const { data: profile } = await db.from('profiles').select('id, name').eq('id', userId).single()
  return NextResponse.json({ exists: true, user: profile })
}
