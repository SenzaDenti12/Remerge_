'use client'; // Make this a client component to use the hook

import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { useAuth } from '@/contexts/AuthContext'
import UserAuthUI from '@/components/user-auth-ui'

export default function Home() {
  // Use the hook to get auth status
  const { user, isLoading } = useAuth();
  
  // Determine the destination for the "Start Creating" button
  const createButtonDestination = user ? '/generate' : '/login?return_to=/generate'
  const createButtonText = user ? 'Create New Video' : 'Create Your First Video – Free'

  // Don't render the main content until auth status is known
  if (isLoading) {
    return <div className="text-center py-20">Loading...</div>; // Or a spinner
  }
  
  return (
    <div className="flex flex-col items-center gap-16">
      {/* Hero Section */}
      <div className="flex flex-col lg:flex-row items-center gap-16 min-h-[calc(100vh-20rem)]">
        <div className="flex-1 text-center lg:text-left space-y-8">
          <div className="space-y-4">
            <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight leading-tight">
              Turn <span className="text-gradient">Any Portrait</span> into a Talking-Head Video
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl">
              ReMerge analyses your footage, writes the script, records the voiceover and lip-syncs the result—<br className="hidden md:inline"/>all in under three minutes.
            </p>
          </div>
          
          <div className="text-xl max-w-2xl space-y-4">
            <p>
              <span className="font-semibold text-primary">Create studio-quality clips in two clicks.</span> Upload a selfie and the video you want commentary on. We handle everything else—script, voice, animation.
            </p>
            <p>
              Perfect for <span className="text-primary">Instagram</span>, <span className="text-primary">TikTok</span>, and <span className="text-primary">YouTube Shorts</span>.
            </p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-8">
            <div className="flex flex-col items-center p-5 bg-card/50 rounded-lg backdrop-blur-sm border border-border/50">
              <span className="text-2xl font-bold text-primary mb-2">HD</span>
              <span className="text-sm text-muted-foreground">Professional Quality</span>
            </div>
            <div className="flex flex-col items-center p-5 bg-card/50 rounded-lg backdrop-blur-sm border border-border/50">
              <span className="text-2xl font-bold text-primary mb-2">Fast</span>
              <span className="text-sm text-muted-foreground">Quick Processing</span>
            </div>
            <div className="flex flex-col items-center p-5 bg-card/50 rounded-lg backdrop-blur-sm border border-border/50">
              <span className="text-2xl font-bold text-primary mb-2">AI Voice</span>
              <span className="text-sm text-muted-foreground">Natural Sound</span>
            </div>
            <div className="flex flex-col items-center p-5 bg-card/50 rounded-lg backdrop-blur-sm border border-border/50">
              <span className="text-2xl font-bold text-primary mb-2">Perfect</span>
              <span className="text-sm text-muted-foreground">Lip Synchronization</span>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-6 pt-6 justify-center lg:justify-start">
            <Link href={createButtonDestination}>
              <Button variant="default" size="lg" className="px-8 py-6 text-lg">{createButtonText}</Button>
            </Link>
            <Link href="/demo">
              <Button variant="outline" size="lg" className="px-8 py-6 text-lg">View Demo</Button>
            </Link>
            {!user && (
              <Link href="/login">
                <Button variant="ghost" size="lg" className="px-8 py-6 text-lg">Sign In</Button>
              </Link>
            )}
          </div>
        </div>
        
        <div className="w-full max-w-lg relative">
          {!user ? (
            <>
              <div className="absolute -inset-4 rounded-xl blur-xl opacity-30 -z-10 bg-gradient-to-br from-primary/40 via-accent/30 to-secondary/40"></div>
              <Card className="relative overflow-hidden bg-card border-border p-2">
                <div className="p-4 sm:p-8">
                  <UserAuthUI /> 
                </div>
              </Card>
            </>
          ) : (
             <div className="mt-12 bg-secondary/10 border border-secondary/20 rounded-lg p-6 backdrop-blur-sm">
              <h3 className="text-xl font-semibold mb-4">Welcome Back!</h3>
              <p className="text-muted-foreground mb-4">Ready to create your next masterpiece?</p>
              <Link href="/dashboard">
                 <Button variant="default" size="lg">Go to Dashboard</Button>
              </Link>
            </div>
          )}
          
          <div className="mt-12 bg-secondary/10 border border-secondary/20 rounded-lg p-6 backdrop-blur-sm">
            <h3 className="text-xl font-semibold mb-4">Perfect for Creators</h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <span className="text-primary mt-1">✓</span>
                <span className="text-base">Content creators seeking viral-worthy videos</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-primary mt-1">✓</span>
                <span className="text-base">Marketers needing engaging social media content</span>
          </li>
              <li className="flex items-start gap-3">
                <span className="text-primary mt-1">✓</span>
                <span className="text-base">Influencers wanting to stand out on social platforms</span>
          </li>
            </ul>
          </div>
        </div>
      </div>
      
      {/* How It Works Section */}
      <div className="w-full max-w-6xl py-16">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4">How It <span className="text-gradient">Works</span></h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Our AI-powered platform makes creating talking head videos simple and seamless
          </p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8 mt-8">
          <div className="bg-card/50 p-6 rounded-lg border border-border/50 backdrop-blur-sm">
            <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center mb-4">
              <span className="text-xl font-bold text-primary">1</span>
            </div>
            <h3 className="text-xl font-semibold mb-2">Upload Your Avatar</h3>
            <p className="text-muted-foreground">Upload any portrait photo to use as your talking head avatar</p>
          </div>
          
          <div className="bg-card/50 p-6 rounded-lg border border-border/50 backdrop-blur-sm">
            <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center mb-4">
              <span className="text-xl font-bold text-primary">2</span>
            </div>
            <h3 className="text-xl font-semibold mb-2">Add Your Video</h3>
            <p className="text-muted-foreground">Upload a video clip you want to explain or comment on</p>
          </div>
          
          <div className="bg-card/50 p-6 rounded-lg border border-border/50 backdrop-blur-sm">
            <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center mb-4">
              <span className="text-xl font-bold text-primary">3</span>
            </div>
            <h3 className="text-xl font-semibold mb-2">Publish Everywhere</h3>
            <p className="text-muted-foreground">Download the finished MP4 or post straight to TikTok, Reels and Shorts.</p>
          </div>
        </div>
        
        <div className="text-center mt-14 flex flex-col sm:flex-row gap-6 justify-center">
          <Link href="/demo">
            <Button variant="outline" size="lg">Watch Demo</Button>
          </Link>
          <Link href="/billing">
            <Button variant="default" size="lg">View Pricing</Button>
          </Link>
        </div>
      </div>
      
      <div className="absolute bottom-0 right-0 w-1/3 h-1/3 bg-primary/5 rounded-full blur-[100px] -z-10"></div>
    </div>
  );
}
