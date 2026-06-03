'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { SplitType, ExpenseCategory } from '@/types/database'

const CATEGORIES: ExpenseCategory[] = ['food', 'travel', 'hotel', 'entertainment', 'other']
const SPLIT_TYPES: { value: SplitType; label: string; hint: string }[] = [
  { value: 'equal', label: 'Equal', hint: 'Split evenly among selected members' },
  { value: 'unequal', label: 'Exact amounts', hint: 'Enter a dollar amount per person' },
  { value: 'percentage', label: 'Percentages', hint: 'Enter % per person (must total 100)' },
  { value: 'share', label: 'Shares', hint: 'Enter shares per person (e.g. 2 and 1 → 67% and 33%)' },
]

interface Member { id: string; name: string }

export default function NewExpenseForm({
  groupId,
  members,
  currentUserId,
}: {
  groupId: string
  members: Member[]
  currentUserId: string
}) {
  const router = useRouter()
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState<ExpenseCategory>('other')
  const [splitType, setSplitType] = useState<SplitType>('equal')
  const [paidBy, setPaidBy] = useState(currentUserId)
  const [selectedIds, setSelectedIds] = useState<string[]>(members.map(m => m.id))
  const [splitValues, setSplitValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function toggleMember(id: string) {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  function setSplitValue(id: string, val: string) {
    setSplitValues(prev => ({ ...prev, [id]: val }))
  }

  function validateSplits(): string | null {
    if (!selectedIds.length) return 'Select at least one member'
    if (splitType === 'percentage') {
      const total = selectedIds.reduce((s, id) => s + parseFloat(splitValues[id] ?? '0'), 0)
      if (Math.abs(total - 100) > 0.01) return `Percentages must total 100 (currently ${total.toFixed(1)})`
    }
    if (splitType === 'unequal') {
      const totalAmt = parseFloat(amount || '0')
      const entered = selectedIds.reduce((s, id) => s + parseFloat(splitValues[id] ?? '0'), 0)
      if (Math.abs(entered - totalAmt) > 0.01) return `Amounts must total $${totalAmt.toFixed(2)} (currently $${entered.toFixed(2)})`
    }
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const validationError = validateSplits()
    if (validationError) { setError(validationError); return }

    setError('')
    setLoading(true)

    const numericValues: Record<string, number> = {}
    selectedIds.forEach(id => {
      numericValues[id] = parseFloat(splitValues[id] ?? '1')
    })

    const res = await fetch(`/api/groups/${groupId}/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description,
        amount,
        split_type: splitType,
        category,
        paid_by: paidBy,
        member_ids: selectedIds,
        split_values: numericValues,
      }),
    })

    setLoading(false)
    if (res.ok) {
      const { expense } = await res.json()
      router.push(`/groups/${groupId}/expenses/${expense.id}`)
      router.refresh()
    } else {
      const data = await res.json()
      setError(data.error ?? 'Failed to create expense')
    }
  }

  const showSplitInputs = splitType !== 'equal'

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
      )}

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <input
          required
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Dinner at Chaayos, Hotel booking…"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Amount */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Total amount ($)</label>
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

      {/* Paid by */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Paid by</label>
        <select
          value={paidBy}
          onChange={e => setPaidBy(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {members.map(m => (
            <option key={m.id} value={m.id}>{m.name}{m.id === currentUserId ? ' (you)' : ''}</option>
          ))}
        </select>
      </div>

      {/* Category */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                category === c
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-300'
              }`}
            >
              {c.charAt(0).toUpperCase() + c.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Split type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Split type</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {SPLIT_TYPES.map(st => (
            <button
              key={st.value}
              type="button"
              onClick={() => setSplitType(st.value)}
              className={`text-left px-3 py-2.5 rounded-lg border text-xs transition ${
                splitType === st.value
                  ? 'bg-indigo-50 border-indigo-400 text-indigo-700'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              <div className="font-medium">{st.label}</div>
              <div className="text-gray-400 mt-0.5 leading-tight">{st.hint}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Members + per-person split inputs */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Split between</label>
        <div className="space-y-2">
          {members.map(m => {
            const selected = selectedIds.includes(m.id)
            return (
              <div
                key={m.id}
                className={`flex items-center gap-3 border rounded-lg px-3 py-2.5 transition ${
                  selected ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200 bg-white'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => toggleMember(m.id)}
                  className="accent-indigo-600"
                />
                <span className="flex-1 text-sm font-medium text-gray-700">
                  {m.name}{m.id === currentUserId ? ' (you)' : ''}
                </span>
                {showSplitInputs && selected && (
                  <input
                    type="number"
                    step={splitType === 'percentage' ? '0.1' : splitType === 'unequal' ? '0.01' : '1'}
                    min="0"
                    value={splitValues[m.id] ?? ''}
                    onChange={e => setSplitValue(m.id, e.target.value)}
                    placeholder={
                      splitType === 'percentage' ? '%' :
                      splitType === 'unequal' ? '$' : 'shares'
                    }
                    className="w-20 border border-gray-300 rounded px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex-1 border border-gray-300 text-gray-600 rounded-lg py-2.5 text-sm font-medium hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-indigo-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? 'Saving…' : 'Save expense'}
        </button>
      </div>
    </form>
  )
}
