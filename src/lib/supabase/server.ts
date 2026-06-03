import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { cache } from 'react'
import type { Database } from '@/types/database'

// Auth client — uses anon key + session cookies (for getUser, signIn, signUp)
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component — cookies set in middleware
          }
        },
      },
    }
  )
}

// Admin client — uses service role key, bypasses RLS
// Singleton: the service-role key never changes, so one instance per warm function
// invocation is safe and avoids re-instantiating the HTTP client on every call.
let _admin: ReturnType<typeof createSupabaseClient<Database>> | null = null
export function createAdminClient() {
  return (_admin ??= createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  ))
}

// Cached getUser for Server Components.
// React cache() deduplicates calls within the same request render tree,
// so layout + page both calling this only triggers one Auth round-trip.
export const getAuthUser = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
})
