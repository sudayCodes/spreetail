'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface PairwiseDebt {
  creditor_id: string
  creditor_name: string
  net_owed: number
}

export default function SettleUpButton({
  groupId,
}: {
  groupId: string
}) {
  const [open, setOpen] = useState(false)
  const [debts, setDebts] = useState<PairwiseDebt[]>([])
  const [receiverId, setReceiverId] = useState('')
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  useEffect(() => {
    if (!open) return
    setFetching(true)
    fetch(`/api/groups/${groupId}/pairwise-debts`)
      .then(r => r.json())
      .then(data => setDebts(data.debts ?? []))
      .catch(() => {})
      .finally(() => setFetching(false))
  }, [open, groupId])

  function handleReceiverChange(uid: string) {
    setReceiverId(uid)
    const debt = debts.find(d => d.creditor_id === uid)
    if (debt) setAmount((debt.net_owed / 100).toFixed(2))
  }

  function handleClose() {
    setOpen(false)
    setError('')
    setReceiverId('')
    setAmount('')
    setDebts([])
  }

  async function handleSettle(e: { preventDefault(): void }) {
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
      handleClose()
      router.refresh()
    } else {
      const data = await res.json()
      setError(data.error ?? 'Failed to record payment')
    }
  }

  const totalOwed = debts.reduce((sum, d) => sum + d.net_owed, 0)

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

            {fetching ? (
              <p className="text-sm text-gray-400 py-2">Loading…</p>
            ) : debts.length === 0 ? (
              <p className="text-sm text-gray-500 py-2">
                You're all settled up — no payments needed.
              </p>
            ) : (
              <>
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <p className="text-xs text-amber-700">
                    You owe{' '}
                    <span className="font-semibold">${(totalOwed / 100).toFixed(2)}</span>{' '}
                    total in this group
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Paying to</label>
                  <select
                    required
                    value={receiverId}
                    onChange={e => handleReceiverChange(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select person…</option>
                    {debts.map(d => (
                      <option key={d.creditor_id} value={d.creditor_id}>
                        {d.creditor_name} — you owe ${(d.net_owed / 100).toFixed(2)}
                      </option>
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
              </>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 border border-gray-300 rounded-lg py-2 text-sm text-gray-500"
              >
                {debts.length === 0 ? 'Close' : 'Cancel'}
              </button>
              {debts.length > 0 && (
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-green-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                >
                  {loading ? 'Saving…' : 'Record payment'}
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </>
  )
}
