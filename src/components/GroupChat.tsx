'use client'

import { useEffect, useRef, useState } from 'react'
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
  initialMessages,
}: {
  groupId: string
  currentUserId: string
  initialMessages: ChatMessage[]
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Supabase Realtime subscription
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`group-chat-${groupId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `group_id=eq.${groupId}`,
        },
        async (payload) => {
          const newMsg = payload.new as { id: string; sender_id: string; content: string; created_at: string }

          // Fetch sender name
          const { data: profile } = await supabase
            .from('profiles')
            .select('name')
            .eq('id', newMsg.sender_id)
            .single()

          setMessages(prev => {
            // Deduplicate — optimistic update already added it
            if (prev.find(m => m.id === newMsg.id)) return prev
            return [...prev, {
              id: newMsg.id,
              sender_id: newMsg.sender_id,
              sender_name: profile?.name ?? 'Unknown',
              content: newMsg.content,
              created_at: newMsg.created_at,
            }]
          })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [groupId])

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || sending) return
    setSending(true)

    // Optimistic update
    const optimisticId = `opt-${Date.now()}`
    setMessages(prev => [...prev, {
      id: optimisticId,
      sender_id: currentUserId,
      sender_name: 'You',
      content: input.trim(),
      created_at: new Date().toISOString(),
    }])
    const content = input.trim()
    setInput('')

    await fetch(`/api/groups/${groupId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })

    setSending(false)
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl flex flex-col h-80">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <p className="text-xs text-gray-400 text-center mt-8">No messages yet. Say something!</p>
        )}
        {messages.map(msg => {
          const isMe = msg.sender_id === currentUserId
          return (
            <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
              <span className="text-xs text-gray-400 mb-0.5">{isMe ? 'You' : msg.sender_name}</span>
              <div className={`max-w-xs px-3 py-2 rounded-2xl text-sm ${
                isMe
                  ? 'bg-indigo-600 text-white rounded-tr-sm'
                  : 'bg-gray-100 text-gray-800 rounded-tl-sm'
              }`}>
                {msg.content}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
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
          className="bg-indigo-600 text-white px-4 py-1.5 rounded-full text-sm font-medium hover:bg-indigo-700 disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  )
}
