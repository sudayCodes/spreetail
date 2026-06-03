'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Toast {
  id: string
  message: string
}

export default function PaymentNotifier({ currentUserId }: { currentUserId: string }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  function addToast(message: string) {
    const id = `${Date.now()}`
    setToasts(prev => [...prev, { id, message }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 5000)
  }

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('payment-notifier')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'settlements' },
        async (payload) => {
          const row = payload.new as {
            receiver_id: string
            payer_id: string
            amount: number
            group_id: string
          }

          if (row.receiver_id !== currentUserId) return

          // Fetch payer name
          const { data: profile } = await supabase
            .from('profiles')
            .select('name')
            .eq('id', row.payer_id)
            .single()

          const payerName = profile?.name ?? 'Someone'
          const amount = `$${(row.amount / 100).toFixed(2)}`
          addToast(`💸 ${payerName} paid you ${amount}`)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [currentUserId])

  if (!toasts.length) return null

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map(t => (
        <div
          key={t.id}
          className="bg-gray-900 text-white text-sm font-medium px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-fade-in"
        >
          {t.message}
        </div>
      ))}
    </div>
  )
}
