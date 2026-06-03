import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { dollarsToCents } from '@/lib/balance'
import { sendSettlementEmail } from '@/lib/email'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: groupId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createAdminClient()
  const { data, error } = await db
    .from('settlements').select('*').eq('group_id', groupId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ settlements: data ?? [] })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: groupId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createAdminClient()

  const { data: membership } = await db
    .from('group_members').select('user_id')
    .eq('group_id', groupId).eq('user_id', user.id).single()
  if (!membership) return NextResponse.json({ error: 'Not a member' }, { status: 403 })

  const { receiver_id, amount } = await request.json()
  if (!receiver_id) return NextResponse.json({ error: 'receiver_id required' }, { status: 400 })
  if (!amount || isNaN(parseFloat(amount))) return NextResponse.json({ error: 'Valid amount required' }, { status: 400 })

  const amountCents = dollarsToCents(amount)
  if (amountCents <= 0) return NextResponse.json({ error: 'Amount must be greater than zero' }, { status: 400 })

  // Guard: check pairwise debt to this specific receiver — not total group balance.
  // Total balance would allow overpaying one person as long as you owe others enough to cover.
  const { data: pairwiseDebts, error: pairwiseErr } = await db.rpc('get_pairwise_debts', {
    p_group_id: groupId,
    p_user_id: user.id,
  })
  if (pairwiseErr) return NextResponse.json({ error: pairwiseErr.message }, { status: 500 })

  const debtToReceiver = (pairwiseDebts ?? []).find(
    (d: { creditor_id: string; net_owed: number }) => d.creditor_id === receiver_id
  )
  if (!debtToReceiver || debtToReceiver.net_owed <= 0) {
    return NextResponse.json({ error: 'You have no outstanding debt to this person in this group' }, { status: 400 })
  }
  if (amountCents > debtToReceiver.net_owed) {
    return NextResponse.json({
      error: `Amount exceeds what you owe this person. You owe $${(debtToReceiver.net_owed / 100).toFixed(2)}`,
    }, { status: 400 })
  }

  const { data: settlement, error } = await db
    .from('settlements')
    .insert({ group_id: groupId, payer_id: user.id, receiver_id, amount: amountCents })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: actorProfile } = await db.from('profiles').select('name').eq('id', user.id).single()
  const { data: receiverProfile } = await db.from('profiles').select('name').eq('id', receiver_id).single()
  await db.from('activity_log').insert({
    group_id: groupId, actor_id: user.id,
    action_type: 'RECORDED_SETTLEMENT',
    description: `${actorProfile?.name ?? 'Someone'} paid ${receiverProfile?.name ?? 'someone'} $${(amountCents / 100).toFixed(2)}`,
  })

  // Email the receiver (fire-and-forget)
  const [{ data: receiverAuth }, { data: group }] = await Promise.all([
    db.auth.admin.getUserById(receiver_id),
    db.from('groups').select('name').eq('id', groupId).single(),
  ])
  const receiverEmail = receiverAuth.user?.email
  if (receiverEmail) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://spreetail-app.vercel.app'
    await sendSettlementEmail({
      to: [receiverEmail],
      payerName: actorProfile?.name ?? 'Someone',
      receiverName: receiverProfile?.name ?? 'you',
      amount: amountCents,
      groupName: group?.name ?? 'your group',
      groupUrl: `${appUrl}/groups/${groupId}`,
    })
  }

  return NextResponse.json({ settlement }, { status: 201 })
}
