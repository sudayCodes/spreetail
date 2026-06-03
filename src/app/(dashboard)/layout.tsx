import { redirect } from 'next/navigation'
import { getAuthUser, createAdminClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import BottomNav from '@/components/BottomNav'
import PaymentNotifier from '@/components/PaymentNotifier'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser()

  if (!user) redirect('/login')

  const db = createAdminClient()
  const { data: profile } = await db
    .from('profiles')
    .select('name')
    .eq('id', user.id)
    .single()

  return (
    <div className="flex h-full">
      <Sidebar userName={profile?.name ?? user.email ?? ''} />
      <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
        {children}
      </main>
      <BottomNav />
      <PaymentNotifier currentUserId={user.id} />
    </div>
  )
}
