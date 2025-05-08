'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

// This component listens for auth changes and refreshes the page 
// to ensure server components get the updated session
export default function AuthListener() {
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // console.log('Auth event:', event) // Optional: for debugging
        
        // Call the backend auth callback endpoint on sign in to ensure user profile is set up with correct credits
        if (event === 'SIGNED_IN' && session) {
          try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/auth/callback`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json'
              }
            });
            
            if (!response.ok) {
              console.error('Failed to initialize user profile');
            }
          } catch (error) {
            console.error('Error initializing user profile:', error);
          }
        }
        
        // On successful sign-in or sign-out, refresh the page 
        // to reload Server Components with the new session
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
            // Using router.refresh() is crucial to update Server Components
            // without losing client-side state unlike window.location.reload()
            router.refresh()
        }
      }
    )

    // Cleanup listener on component unmount
    return () => {
      authListener?.subscription.unsubscribe()
    }
  }, [supabase, router]) // Add dependencies

  return null // This component doesn't render anything
} 