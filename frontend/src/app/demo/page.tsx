import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function DemoPage() {
  // Check if user is authenticated to customize the CTA
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  // Determine the destination for the "Start Creating" button
  const createButtonDestination = user ? '/dashboard' : '/login?return_to=/generate';
  
  return (
    <div className="flex flex-col items-center gap-16 pb-16">
      {/* Hero */}
      <div className="w-full text-center space-y-4 max-w-4xl">
        <h1 className="text-5xl font-bold tracking-tight">
          <span className="text-gradient">See ReMerge in Action</span>
        </h1>
        <p className="text-xl text-muted-foreground">
          Watch how our AI transforms images and videos into engaging content
        </p>
      </div>
      
      {/* Video Demo Section */}
      <div className="w-full max-w-5xl">
        <Card className="overflow-hidden border-border/50 bg-card/80 backdrop-blur-sm">
          <CardContent className="p-0">
            {/* Replace this placeholder with an actual demo video embed */}
            <div className="aspect-video bg-background/50 flex items-center justify-center">
              <div className="text-center p-8">
                <h3 className="text-2xl font-semibold mb-4">Demo Video</h3>
                <p className="text-muted-foreground mb-6">
                  Example of a talking-head video created with ReMerge
                </p>
                {/* This div would be replaced by your actual video */}
                <div className="aspect-video max-w-lg mx-auto bg-black/30 rounded-lg flex items-center justify-center">
                  <p className="text-muted-foreground">Video Placeholder - Add your demo video here</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* How It Works Section */}
      <div className="w-full max-w-6xl">
        <h2 className="text-3xl font-bold text-center mb-12">How ReMerge Works</h2>
        
        <div className="grid md:grid-cols-2 gap-10">
          <div className="space-y-6">
            <div className="bg-card/50 rounded-lg p-6 border border-border/50">
              <h3 className="text-xl font-semibold mb-3 flex items-center">
                <span className="bg-primary/20 w-8 h-8 rounded-full flex items-center justify-center mr-3 text-primary font-bold">1</span>
                Analyze Your Video
              </h3>
              <p className="text-muted-foreground">
                Our AI analyzes your uploaded video frame by frame, understanding the context and content.
              </p>
            </div>
            
            <div className="bg-card/50 rounded-lg p-6 border border-border/50">
              <h3 className="text-xl font-semibold mb-3 flex items-center">
                <span className="bg-primary/20 w-8 h-8 rounded-full flex items-center justify-center mr-3 text-primary font-bold">2</span>
                Generate a Script
              </h3>
              <p className="text-muted-foreground">
                Based on the video analysis, our AI writes a clever, engaging script that matches the content.
              </p>
            </div>
            
            <div className="bg-card/50 rounded-lg p-6 border border-border/50">
              <h3 className="text-xl font-semibold mb-3 flex items-center">
                <span className="bg-primary/20 w-8 h-8 rounded-full flex items-center justify-center mr-3 text-primary font-bold">3</span>
                Apply Lip Sync Technology
              </h3>
              <p className="text-muted-foreground">
                We animate your portrait with advanced lip synchronization to perfectly match the generated voice.
              </p>
            </div>
            
            <div className="bg-card/50 rounded-lg p-6 border border-border/50">
              <h3 className="text-xl font-semibold mb-3 flex items-center">
                <span className="bg-primary/20 w-8 h-8 rounded-full flex items-center justify-center mr-3 text-primary font-bold">4</span>
                Deliver Your Final Video
              </h3>
              <p className="text-muted-foreground">
                Get a professionally composed split-screen meme video ready to share on social media.
              </p>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-primary/10 via-secondary/10 to-accent/10 p-8 rounded-2xl backdrop-blur-sm border border-border/20 flex flex-col justify-center space-y-8">
            <h3 className="text-2xl font-bold">Try It Yourself</h3>
            
            <div className="space-y-4">
              <p className="text-lg">
                Create your first talking head video in minutes. Just upload your portrait and a video clip.
              </p>
              
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <span className="text-primary text-lg mt-1">✓</span>
                  <span>Start with a free credit</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-primary text-lg mt-1">✓</span>
                  <span>No technical skills required</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-primary text-lg mt-1">✓</span>
                  <span>Ready to share in minutes</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-primary text-lg mt-1">✓</span>
                  <span>Professional quality results</span>
                </li>
              </ul>
            </div>
            
            <div className="pt-4">
              <Link href={createButtonDestination}>
                <Button size="lg" className="w-full py-6 text-lg">
                  Start Creating for Free
                </Button>
              </Link>
              <p className="text-sm text-muted-foreground mt-3 text-center">
                No credit card required to get started
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* FAQ Section */}
      <div className="w-full max-w-4xl mt-10">
        <h2 className="text-3xl font-bold text-center mb-8">Frequently Asked Questions</h2>
        
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-card/50 rounded-lg p-6 border border-border/50">
            <h3 className="text-xl font-semibold mb-2">How much does it cost?</h3>
            <p className="text-muted-foreground">
              You get one free credit to create your first video. After that, subscription plans start at $9.99/month.
            </p>
          </div>
          
          <div className="bg-card/50 rounded-lg p-6 border border-border/50">
            <h3 className="text-xl font-semibold mb-2">How long does it take?</h3>
            <p className="text-muted-foreground">
              Most videos are processed and ready within 3-5 minutes, depending on length and complexity.
            </p>
          </div>
          
          <div className="bg-card/50 rounded-lg p-6 border border-border/50">
            <h3 className="text-xl font-semibold mb-2">Can I edit the script?</h3>
            <p className="text-muted-foreground">
              Yes! You can review and edit the AI-generated script before it's used for your talking head animation.
            </p>
          </div>
          
          <div className="bg-card/50 rounded-lg p-6 border border-border/50">
            <h3 className="text-xl font-semibold mb-2">What formats are supported?</h3>
            <p className="text-muted-foreground">
              We support JPG, PNG, and WEBP for avatars, and MP4 videos up to 90 seconds for source clips.
            </p>
          </div>
        </div>
      </div>
      
      {/* CTA */}
      <div className="w-full max-w-3xl text-center space-y-6 mt-8">
        <h2 className="text-3xl font-bold">Ready to create your first video?</h2>
        <p className="text-xl text-muted-foreground">
          Start with a free credit and see the magic happen
        </p>
        <Link href={createButtonDestination}>
          <Button size="lg" className="px-8 py-6 text-lg">
            Get Started Now
          </Button>
        </Link>
      </div>
      
      <div className="absolute top-1/4 right-0 w-1/2 h-1/2 bg-primary/5 rounded-full blur-[150px] -z-10"></div>
      <div className="absolute bottom-0 left-0 w-1/3 h-1/3 bg-secondary/5 rounded-full blur-[120px] -z-10"></div>
    </div>
  );
} 