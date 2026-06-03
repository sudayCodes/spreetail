'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Member {
  user_id: string
  name: string
  joined_at: string
}

export default function MemberList({
  groupId,
  currentUserId,
  members,
}: {
  groupId: string
  currentUserId: string
  members: Member[]
}) {
  const router = useRouter()
  const [removing, setRemoving] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function removeMember(userId: string) {
    setRemoving(userId)
    setError('')
    const res = await fetch(`/api/groups/${groupId}/members?userId=${userId}`, {
      method: 'DELETE',
    })
    setRemoving(null)
    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Could not remove member')
    } else {
      router.refresh()
    }
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-sm text-red-500">{error}</p>}
      {members.map(m => (
        <div
          key={m.user_id}
          className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3"
        >
          <div>
            <p className="text-sm font-medium">{m.name}</p>
            <p className="text-xs text-gray-400">
              Joined {new Date(m.joined_at).toLocaleDateString()}
            </p>
          </div>
          {m.user_id === currentUserId ? (
            <span className="text-xs text-gray-400">You</span>
          ) : (
            <button
              onClick={() => removeMember(m.user_id)}
              disabled={removing === m.user_id}
              className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50"
            >
              {removing === m.user_id ? 'Removing…' : 'Remove'}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
