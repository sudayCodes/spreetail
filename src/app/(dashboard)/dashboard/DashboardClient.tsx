'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface BalanceRow {
  group_id: string
  name: string
  balance: number
  type: string
}

interface ActivityRow {
  id: string
  group_id: string
  description: string
  created_at: string
}

export default function DashboardClient({
  balances,
  totalOwed,
  totalOwedToYou,
  net,
  recentActivity,
}: {
  balances: BalanceRow[]
  totalOwed: number
  totalOwedToYou: number
  net: number
  recentActivity: ActivityRow[]
}) {
  const [view, setView] = useState<'list' | 'chart'>('list')

  const nonZeroBalances = balances.filter(b => b.balance !== 0)

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-4 text-center">
          <p className="text-xs text-gray-400 uppercase tracking-wide">You owe</p>
          <p className="text-2xl font-bold text-red-500 mt-1">${(totalOwed / 100).toFixed(2)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-4 text-center">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Owed to you</p>
          <p className="text-2xl font-bold text-green-600 mt-1">${(totalOwedToYou / 100).toFixed(2)}</p>
        </div>
        <div className={`border rounded-xl px-4 py-4 text-center ${net >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <p className="text-xs text-gray-400 uppercase tracking-wide">Net balance</p>
          <p className={`text-2xl font-bold mt-1 ${net >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {net >= 0 ? '+' : '-'}${(Math.abs(net) / 100).toFixed(2)}
          </p>
        </div>
      </div>

      {/* Balances section */}
      {nonZeroBalances.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Balances by group</h2>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
              {(['list', 'chart'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition ${
                    view === v ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'
                  }`}
                >
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {view === 'list' ? (
            <ul className="space-y-2">
              {nonZeroBalances.map(b => (
                <li key={b.group_id}>
                  <Link
                    href={b.type === 'direct' ? '/friends' : `/groups/${b.group_id}`}
                    className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-indigo-300 transition"
                  >
                    <span className="text-sm font-medium">{b.name}</span>
                    <span className={`text-sm font-bold ${b.balance >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {b.balance >= 0 ? '+' : '-'}${(Math.abs(b.balance) / 100).toFixed(2)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl p-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={nonZeroBalances} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={v => `$${(Math.abs(v) / 100).toFixed(0)}`} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value) => {
                      const v = typeof value === 'number' ? value : 0
                      return [`$${(Math.abs(v) / 100).toFixed(2)}`, v >= 0 ? 'Owed to you' : 'You owe'] as [string, string]
                    }}
                  />
                  <Bar dataKey="balance" radius={[4, 4, 0, 0]}>
                    {nonZeroBalances.map((b, i) => (
                      <Cell key={i} fill={b.balance >= 0 ? '#22c55e' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      )}

      {nonZeroBalances.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg font-medium">All settled up!</p>
          <p className="text-sm mt-1">No outstanding balances across any group.</p>
        </div>
      )}

      {/* Recent activity */}
      {recentActivity.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Recent activity</h2>
            <Link href="/activity" className="text-xs text-indigo-600 hover:underline">View all</Link>
          </div>
          <ul className="space-y-1.5">
            {recentActivity.map(a => (
              <li key={a.id} className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3">
                <div className="flex-1">
                  <p className="text-sm text-gray-700">{a.description}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{new Date(a.created_at).toLocaleDateString()}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
