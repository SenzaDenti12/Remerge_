import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Define protected routes that require authentication
const PROTECTED_ROUTES = ['/dashboard', '/generate']

// Define routes that require authentication only for specific actions
// These routes are viewable without auth but certain actions need auth
const PARTIAL_PROTECTED_ROUTES = {
  '/billing': ['/checkout', '/purchase'] // sub-paths that need auth
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Create an unmodified Supabase client for server-side operations
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // A default implementation passing the cookie store directly
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          // If the cookie is set, update the request cookies.
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          // Set the cookie for the response.
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          // If the cookie is removed, update the request cookies.
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          // Delete the cookie for the response.
          response.cookies.delete({
            name,
            ...options,
          })
        },
      },
    }
  )

  // Refresh session if expired
  const { data: { user } } = await supabase.auth.getUser()

  // Check if the request is for a protected route
  const url = new URL(request.url)
  const isProtectedRoute = PROTECTED_ROUTES.some(route => 
    url.pathname === route || url.pathname.startsWith(`${route}/`)
  )

  // Check if the route has partial protection (certain actions need auth)
  let needsAuthForAction = false;
  for (const [basePath, protectedPaths] of Object.entries(PARTIAL_PROTECTED_ROUTES)) {
    if (url.pathname.startsWith(basePath)) {
      // Check if any protected sub-paths are in the current URL
      needsAuthForAction = protectedPaths.some(subPath => 
        url.pathname.includes(subPath)
      );
      break;
    }
  }

  // If accessing a protected route or protected action without authentication, redirect to login
  if ((isProtectedRoute || needsAuthForAction) && !user) {
    const redirectUrl = new URL('/login', request.url)
    // Optionally add a return_to parameter to redirect back after login
    redirectUrl.searchParams.set('return_to', url.pathname)
    return NextResponse.redirect(redirectUrl)
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|api/).*)',
  ],
} 