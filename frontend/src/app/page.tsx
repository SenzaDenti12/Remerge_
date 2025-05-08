import UserAuthUI from '@/components/user-auth-ui'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Card } from '@/components/ui/card'

export default function Home() {
  return (
    <div className="flex flex-col lg:flex-row items-center gap-16 min-h-[calc(100vh-20rem)]">
      <div className="flex-1 text-center lg:text-left space-y-8">
        <div className="space-y-4">
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight glow-text leading-tight">
            Create <span className="text-gradient">Viral Videos</span> with AI
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl">
            Transform your content into engaging videos for social media with advanced AI technology
          </p>
        </div>
        
        <p className="text-xl max-w-2xl">
          ReMerge uses cutting-edge AI to help you create professional-quality videos 
          for <span className="text-primary">Instagram</span>, <span className="text-primary">TikTok</span>, and <span className="text-primary">YouTube Shorts</span>.
        </p>
        
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
        
        <div className="flex flex-col sm:flex-row gap-5 pt-4 justify-center lg:justify-start">
          <Link href="/dashboard">
            <Button variant="default" size="lg" className="px-8 py-6 text-lg">Start Creating</Button>
          </Link>
          <Link href="/login">
            <Button variant="outline" size="lg" className="px-8 py-6 text-lg">Sign In</Button>
          </Link>
        </div>
      </div>
      
      <div className="w-full max-w-lg relative">
        <div className="absolute -inset-4 rounded-xl blur-xl opacity-30 -z-10 bg-gradient-to-br from-primary/40 via-accent/30 to-secondary/40"></div>
        <Card className="relative overflow-hidden bg-card border-border p-2">
          <div className="p-4 sm:p-8">
            <UserAuthUI /> 
          </div>
        </Card>
        
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
      
      <div className="absolute bottom-0 right-0 w-1/3 h-1/3 bg-primary/5 rounded-full blur-[100px] -z-10"></div>
    </div>
  );
}
