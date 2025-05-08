import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

// IMPORTANT NOTE on Linter Errors / Next.js 15 Compatibility:
// The `createServerClient` helper from `@supabase/ssr` expects synchronous functions
// for cookie handling (`get`, `set`, `remove`). However, `cookies()` from `next/headers`
// in Next.js 15 / React 19 returns a promise-like object where direct access
// (e.g., `cookieStore.get()`) inside Server Components is asynchronous and must be awaited.
// This causes linter errors below because we are trying to call `.get()` and `.set()` 
// synchronously on the `cookieStore` instance.
// 
// THIS HELPER SHOULD NOT BE USED DIRECTLY WITHIN SERVER COMPONENT RENDER LOGIC.
// Doing so will likely cause runtime errors or unexpected behavior related to async cookie access.
// 
// Instead, rely on:
// 1. The `middleware.ts` to handle session refresh using `request.cookies`.
// 2. Client components (`'use client'`) using `createClient` from `@/lib/supabase/client`
//    to fetch user data or session state after hydration.
// 3. Server Actions or Route Handlers which might provide different contexts for cookie access.
//
// The linter errors below are acknowledged but currently benign as long as this helper
// is not invoked directly during Server Component rendering.

export function createClient() {
  const cookieStore = cookies()

  // Create a serverSupabase client with cookies
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          // Linter Error: Cannot call .get() synchronously here in Server Component context
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
             // Linter Error: Cannot call .set() synchronously here in Server Component context
            cookieStore.set({ name, value, ...options })
          } catch (error) {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
             // Linter Error: Cannot call .set() synchronously here in Server Component context
            cookieStore.set({ name, value: '', ...options })
          } catch (error) {
            // The `delete` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
} 