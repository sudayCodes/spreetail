'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AddFriendButton() {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Create a direct group named after the friend's email, then add them
    const createRes = await fetch('/api/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: email.trim(), type: 'direct' }),
    })

    if (!createRes.ok) {
      setError('Failed to create friend link')
      setLoading(false)
      return
    }

    const { group } = await createRes.json()

    const addRes = await fetch(`/api/groups/${group.id}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })

    setLoading(false)

    if (addRes.ok) {
      setOpen(false)
      setEmail('')
      router.push(`/groups/${group.id}`)
      router.refresh()
    } else {
      // Clean up the group if member add failed
      const data = await addRes.json()
      setError(data.error ?? 'Failed to add friend')
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
      >
        + Add friend
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <form onSubmit={handleAdd} className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm space-y-4">
            <h2 className="text-lg font-semibold">Add a friend</h2>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <input
              autoFocus
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="friend@example.com"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 text-sm text-gray-500">Cancel</button>
              <button type="submit" disabled={loading} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                {loading ? 'Adding…' : 'Add'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
