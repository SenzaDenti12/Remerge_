'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card"
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function AuthForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnTo = searchParams.get('return_to') || '/dashboard'

  // Handle email + password auth
  const handleEmailPasswordAuth = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    
    try {
      if (authMode === 'signup') {
        // Check if passwords match for signup
        if (password !== confirmPassword) {
          toast.error('Passwords do not match')
          setIsSubmitting(false)
          return
        }
        
        // Sign up with email and password
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?return_to=${encodeURIComponent(returnTo)}`,
          }
        })
        
        if (error) {
          toast.error(`Error: ${error.message}`)
        } else {
          toast.success('Account created! Check your email for confirmation.')
        }
      } else {
        // Sign in with email and password
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        })
        
        if (error) {
          toast.error(`Error: ${error.message}`)
        } else {
          // Show success toast
          toast.success('Login successful!')
          
          // Explicitly navigate to dashboard or returnTo path
          if (returnTo && returnTo !== '/dashboard') {
            router.push(returnTo)
          } else {
            router.push('/dashboard')
          }
        }
      }
    } catch (error) {
      console.error('Unexpected error:', error)
      toast.error('An unexpected error occurred. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="text-3xl font-bold">
          {authMode === 'login' ? 'Welcome Back!' : 'Create Your Account'}
        </CardTitle>
        <CardDescription>
          {authMode === 'login' ? 'Sign in using your email and password.' : 'Sign up with your email and password.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Email + Password Form directly, no tabs */}
        <div className="flex gap-4 mb-6">
          <Button 
            variant={authMode === 'login' ? 'default' : 'outline'} 
            className="flex-1"
            onClick={() => setAuthMode('login')}
          >
            Login
          </Button>
          <Button 
            variant={authMode === 'signup' ? 'default' : 'outline'} 
            className="flex-1"
            onClick={() => setAuthMode('signup')}
          >
            Sign Up
          </Button>
        </div>
              
        <form onSubmit={handleEmailPasswordAuth} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email-password">Email Address</Label>
            <Input
              id="email-password"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              disabled={isSubmitting}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Your password"
              disabled={isSubmitting}
            />
          </div>
          
          {authMode === 'signup' && (
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="Confirm password"
                disabled={isSubmitting}
              />
            </div>
          )}
          
          <Button 
            type="submit" 
            disabled={isSubmitting || !email || !password || (authMode === 'signup' && !confirmPassword)} 
            className="w-full"
          >
            {isSubmitting ? 'Processing...' : (authMode === 'login' ? 'Login' : 'Create Account')}
          </Button>
        </form>
      </CardContent>
      
      <CardFooter className="flex flex-col">
        <div className="relative my-6 w-full">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">
              VIRAL VIDEO CREATOR
            </span>
          </div>
        </div>
        <p className="text-sm text-center text-muted-foreground">
          By continuing, you agree to our <Link href="/terms-of-service" className="underline hover:text-primary">Terms of Service</Link> and <Link href="/privacy-policy" className="underline hover:text-primary">Privacy Policy</Link>.
          Your email will only be used for authentication purposes.
        </p>
      </CardFooter>
    </Card>
  )
}