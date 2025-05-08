'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card"

export default function AuthForm() {
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isEmailSent, setIsEmailSent] = useState(false)
  const supabase = createClient()

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email,
        options: {
          // set this to false if you do not want the user to be automatically signed up
          shouldCreateUser: true,
          emailRedirectTo: window.location.origin, // Redirect back to the app
        },
      })

      if (error) {
        console.error('Error sending magic link:', error)
        // Replace with user-friendly notification
        toast.error(`Error: ${error.message}`) // Use toast.error
      } else {
        setIsEmailSent(true)
        toast.success('Check your email for the magic link!') // Use toast.success
      }
    } catch (error) {
        console.error('Unexpected error:', error)
        toast.error('An unexpected error occurred. Please try again.') // Use toast.error
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="w-full max-w-lg mx-auto group animate-float">
      <CardHeader className="space-y-4 text-center">
        <div className="mx-auto mb-6 size-20 rounded-full bg-gradient-to-br from-primary/80 to-accent/80 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary-foreground"><circle cx="12" cy="12" r="10"/><path d="M18 9a5 5 0 0 0-6-1c-2 1-3 3-4 4l-2 2"/><path d="M12 12a5 5 0 0 0-6 8"/></svg>
        </div>
        <CardTitle className="text-3xl md:text-4xl font-extrabold logo-text text-gradient">ReMerge</CardTitle>
        <CardDescription className="text-xl">AI-Powered Video Transformation Studio</CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-8">
        {isEmailSent ? (
          <div className="text-center space-y-6">
            <div className="mx-auto rounded-full size-20 bg-accent/20 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent"><path d="M22 7.11v9.78A2.11 2.11 0 0 1 19.89 19H4.11A2.11 2.11 0 0 1 2 16.89V7.11A2.11 2.11 0 0 1 4.11 5h15.78A2.11 2.11 0 0 1 22 7.11Z"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
            </div>
            <div>
              <h3 className="text-2xl font-medium glow-text mb-3">Magic Link Sent!</h3>
              <p className="text-lg text-muted-foreground mb-6">
                Please check your email inbox for a login link. Be sure to check your spam folder if you don't see it right away.
              </p>
              <Button 
                variant="outline" 
                onClick={() => setIsEmailSent(false)}
                className="mt-2"
                size="lg"
              >
                Try a different email
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-3">
              <Label htmlFor="email" className="text-lg text-foreground">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                disabled={isSubmitting}
                className="bg-secondary/20 border-secondary/30 h-14 px-5 text-lg focus:ring-2 focus:ring-primary/50 focus:shadow-glow-sm-primary transition duration-200"
              />
              <p className="text-base text-muted-foreground mt-2">We'll send you a magic link to sign in instantly.</p>
            </div>
            <Button 
              type="submit" 
              disabled={isSubmitting || !email} 
              variant="default"
              size="lg"
              className="w-full py-6 text-lg"
            >
              {isSubmitting ? 'Sending Magic Link...' : 'Sign In with Email'}
            </Button>
          </form>
        )}
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
          By continuing, you agree to our Terms of Service and Privacy Policy.
          Your email will only be used for authentication purposes.
        </p>
      </CardFooter>
    </Card>
  )
}