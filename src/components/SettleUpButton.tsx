'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Balance {
  group_id: string
  name: string
  balance: number
  type: string
}

export default function SettleUpButton({ groupId }: { groupId: string }) {
  const [open, setOpen] = useState(false)
  const [members, setMembers] = useState<{ id: string; name: string }[]>([])
  const [receiverId, setReceiverId] = useState('')
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  useEffect(() => {
    if (!open) return
    fetch(`/api/groups/${groupId}/balances`)
      .then(r => r.json())
      .then(data => {
        const nonZero = (data.balances as Balance[])
          .filter(b => b.balance !== 0)
          .map(b => ({ id: b.group_id, name: b.name }))
        setMembers(nonZero)
      })
      .catch(() => {})
  }, [open, groupId])

  async function handleSettle(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch(`/api/groups/${groupId}/settlements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receiver_id: receiverId, amount }),
    })
    setLoading(false)
    if (res.ok) {
      setOpen(false)
      setAmount('')
      router.refresh()
    } else {
      const data = await res.json()
      setError(data.error ?? 'Failed to record payment')
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full border border-green-400 text-green-700 bg-green-50 hover:bg-green-100 rounded-xl py-2.5 text-sm font-medium transition"
      >
        Settle up
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <form
            onSubmit={handleSettle}
            className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm space-y-4"
          >
            <h2 className="text-lg font-semibold">Record a payment</h2>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Paying to</label>
              <select
                required
                value={receiverId}
                onChange={e => setReceiverId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select person…</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount ($)</label>
              <input
                required
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={() => setOpen(false)} className="flex-1 border border-gray-300 rounded-lg py-2 text-sm text-gray-500">
                Cancel
              </button>
              <button type="submit" disabled={loading} className="flex-1 bg-green-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                {loading ? 'Saving…' : 'Record payment'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
