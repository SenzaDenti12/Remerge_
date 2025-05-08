'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'

export default function UserAuthUI() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      setLoading(false)
    }
    checkUser()

    // Listen for auth changes to update UI immediately
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
        setUser(session?.user ?? null)
        // No need to router.refresh here as this component handles its own state
        // AuthListener in layout handles refreshing server components if needed elsewhere
    })

    return () => {
        authListener?.subscription.unsubscribe()
    }
  }, [supabase])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null) // Update local state immediately
    router.push('/login') // Redirect to login
    router.refresh() // Refresh server state just in case
  }

  if (loading) {
    return <div className="text-center"><p>Loading...</p></div>
  }

  return (
    <div className="text-center">
      {user ? (
        <div>
          <p className="mb-4">Welcome, {user.email}!</p>
          <p className="mb-4">You are logged in.</p>
          <Link href="/dashboard">
            <Button variant="outline" className="mr-4">Go to Dashboard</Button>
          </Link>
          {/* No form needed, just call handleLogout on click */}
          <Button onClick={handleLogout}>Logout</Button>
        </div>
      ) : (
        <div>
          <p className="mb-4">Please log in to generate memes.</p>
          <Link href="/login">
             <Button>Login / Sign Up</Button>
          </Link>
        </div>
      )}
    </div>
  )
} 