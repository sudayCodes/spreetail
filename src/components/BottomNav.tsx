'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/dashboard', label: 'Home', icon: '⊟' },
  { href: '/groups', label: 'Groups', icon: '◫' },
  { href: '/friends', label: 'Friends', icon: '◎' },
  { href: '/expenses', label: 'Expenses', icon: '≡' },
  { href: '/activity', label: 'Activity', icon: '◷' },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 flex">
      {NAV.map(({ href, label, icon }) => {
        const active = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link
            key={href}
            href={href}
            className={`flex-1 flex flex-col items-center justify-center py-2 text-xs font-medium transition-colors ${
              active ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <span className="text-lg leading-none mb-0.5">{icon}</span>
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
