'use client'

import { useState, useEffect, useRef } from 'react'
import QRCode from 'qrcode'

export default function InvitePanel({ groupId, inviteUrl }: { groupId: string; inviteUrl: string }) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [copied, setCopied] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [showQr, setShowQr] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    QRCode.toDataURL(inviteUrl, { width: 200, margin: 1 }).then(setQrDataUrl)
  }, [inviteUrl])

  async function handleAddByEmail(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    const res = await fetch(`/api/groups/${groupId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    const data = await res.json()
    if (res.ok) {
      setStatus('success')
      setMessage(`${data.member.name} added!`)
      setEmail('')
    } else {
      setStatus('error')
      setMessage(data.error ?? 'Failed to add member')
    }
    setTimeout(() => setStatus('idle'), 3000)
  }

  async function copyLink() {
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-5">
      {/* Add by email */}
      <form onSubmit={handleAddByEmail} className="flex gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="friend@example.com"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          Add
        </button>
      </form>

      {status !== 'idle' && (
        <p className={`text-sm ${status === 'success' ? 'text-green-600' : 'text-red-500'}`}>
          {message}
        </p>
      )}

      {/* Invite link */}
      <div className="flex items-center gap-2">
        <input
          readOnly
          value={inviteUrl}
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-500 bg-gray-50"
        />
        <button
          onClick={copyLink}
          className="shrink-0 border border-gray-300 rounded-lg px-3 py-2 text-xs font-medium hover:bg-gray-50"
        >
          {copied ? 'Copied!' : 'Copy link'}
        </button>
        <button
          onClick={() => setShowQr(v => !v)}
          className="shrink-0 border border-gray-300 rounded-lg px-3 py-2 text-xs font-medium hover:bg-gray-50"
        >
          QR
        </button>
      </div>

      {showQr && qrDataUrl && (
        <div className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt="Invite QR code" width={160} height={160} className="rounded-lg" />
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}
