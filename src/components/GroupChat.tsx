'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface ChatMessage {
  id: string
  sender_id: string
  sender_name: string
  content: string
  created_at: string
}

export default function GroupChat({
  groupId,
  currentUserId,
  currentUserName,
  initialMessages,
}: {
  groupId: string
  currentUserId: string
  currentUserName: string
  initialMessages: ChatMessage[]
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)

  function scrollToBottom() {
    const el = containerRef.current
    if (el) el.scrollTop = el.scrollHeight
  }

  function isNearBottom() {
    const el = containerRef.current
    if (!el) return true
    return el.scrollHeight - el.scrollTop - el.clientHeight < 120
  }

  // Scroll to bottom once on mount — no animation so it doesn't feel jumpy
  useEffect(() => {
    scrollToBottom()
  }, [])

  // Incoming messages from others: only scroll if already near the bottom
  const addMessage = useCallback((msg: ChatMessage) => {
    setMessages(prev => {
      if (prev.find(m => m.id === msg.id)) return prev
      if (isNearBottom()) setTimeout(() => scrollToBottom(), 0)
      return [...prev, msg]
    })
  }, [])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel(`group-chat-${groupId}`)

    channel
      .on('broadcast', { event: 'new_message' }, ({ payload }) => {
        // Skip messages sent by this tab (already added optimistically)
        if (payload.sender_id !== currentUserId) {
          addMessage(payload as ChatMessage)
        }
      })
      .subscribe()

    channelRef.current = channel
    return () => { supabase.removeChannel(channel) }
  }, [groupId, currentUserId, addMessage])

  async function sendMessage(e: { preventDefault(): void }) {
    e.preventDefault()
    if (!input.trim() || sending) return
    setSending(true)

    const content = input.trim()
    const optimisticId = `opt-${Date.now()}`
    const optimistic: ChatMessage = {
      id: optimisticId,
      sender_id: currentUserId,
      sender_name: currentUserName,
      content,
      created_at: new Date().toISOString(),
    }

    // Optimistic update — always scroll when you send your own message
    setMessages(prev => [...prev, optimistic])
    setInput('')
    setTimeout(() => scrollToBottom(), 0)

    // Save to DB
    const res = await fetch(`/api/groups/${groupId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })

    if (res.ok) {
      const { message } = await res.json()
      // Replace optimistic entry with real DB row
      setMessages(prev => prev.map(m => m.id === optimisticId ? {
        id: message.id,
        sender_id: message.sender_id,
        sender_name: currentUserName,
        content: message.content,
        created_at: message.created_at,
      } : m))

      // Broadcast to other members
      channelRef.current?.send({
        type: 'broadcast',
        event: 'new_message',
        payload: {
          id: message.id,
          sender_id: message.sender_id,
          sender_name: currentUserName,
          content: message.content,
          created_at: message.created_at,
        },
      })
    }

    setSending(false)
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl flex flex-col h-80 md:h-96">
      <div ref={containerRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <p className="text-xs text-gray-400 text-center mt-8">No messages yet. Say something!</p>
        )}
        {messages.map(msg => {
          const isMe = msg.sender_id === currentUserId
          return (
            <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
              <span className="text-xs text-gray-400 mb-0.5">{isMe ? 'You' : msg.sender_name}</span>
              <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm break-words ${
                isMe
                  ? 'bg-indigo-600 text-white rounded-tr-sm'
                  : 'bg-gray-100 text-gray-800 rounded-tl-sm'
              }`}>
                {msg.content}
              </div>
            </div>
          )
        })}
      </div>

      <form onSubmit={sendMessage} className="border-t border-gray-100 px-3 py-2 flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Type a message…"
          className="flex-1 text-sm px-3 py-1.5 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <button
          type="submit"
          disabled={!input.trim() || sending}
          className="bg-indigo-600 text-white px-4 py-1.5 rounded-full text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 shrink-0"
        >
          Send
        </button>
      </form>
    </div>
  )
}
