'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { toast } from 'sonner'
import type { User } from '@supabase/supabase-js'
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Edit2Icon, SaveIcon, XIcon } from 'lucide-react'

// Video type definition for past creations
interface VideoCreation {
  id: string;
  created_at: string;
  title: string;
  url: string;
  thumbnail?: string;
}

export default function DashboardClientComponent() {
  const [user, setUser] = useState<User | null>(null);
  const [credits, setCredits] = useState<number | string>('Loading...');
  const [loading, setLoading] = useState(true);
  const [pastVideos, setPastVideos] = useState<VideoCreation[]>([]);
  const supabase = createClient();

  // State for inline editing
  const [editingVideoId, setEditingVideoId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>("");

  useEffect(() => {
    const fetchData = async () => {
        setLoading(true);
        // Check user first
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !session) {
            console.error("Session error:", sessionError);
            toast.error("Session error. Please log in again.");
            setLoading(false);
            return;
        }
        
        setUser(session.user);
        const token = session.access_token;

        // Fetch credits from backend
        try {
            const creditsResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/credits`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (!creditsResponse.ok) {
                 const errorData = await creditsResponse.json().catch(() => ({}));
                 throw new Error(errorData.detail || "Failed to fetch credits");
            }
            const data = await creditsResponse.json();
            setCredits(data.credits);
            
            // Fetch past videos
            try {
                const videosResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/past-videos`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                if (videosResponse.ok) {
                    const videoData = await videosResponse.json();
                    setPastVideos(videoData.videos || []);
                } else {
                    console.error("Failed to fetch past videos");
                    // If the endpoint doesn't exist yet, we'll use sample data
                    setPastVideos([
                        {
                            id: '1',
                            created_at: new Date().toISOString(),
                            title: 'Product Demo',
                            url: 'https://example.com/video1.mp4',
                            thumbnail: 'https://via.placeholder.com/320x180/0A0A0A/FFFFFF?text=Product+Demo'
                        },
                        {
                            id: '2',
                            created_at: new Date(Date.now() - 86400000).toISOString(),
                            title: 'Social Media Ad',
                            url: 'https://example.com/video2.mp4',
                            thumbnail: 'https://via.placeholder.com/320x180/0A0A0A/FFFFFF?text=Social+Media+Ad'
                        }
                    ]);
                }
            } catch (error) {
                console.error("Error fetching past videos:", error);
                // Use sample data
                setPastVideos([
                    {
                        id: '1',
                        created_at: new Date().toISOString(),
                        title: 'Product Demo',
                        url: 'https://example.com/video1.mp4',
                        thumbnail: 'https://via.placeholder.com/320x180/0A0A0A/FFFFFF?text=Product+Demo'
                    },
                    {
                        id: '2',
                        created_at: new Date(Date.now() - 86400000).toISOString(),
                        title: 'Social Media Ad',
                        url: 'https://example.com/video2.mp4',
                        thumbnail: 'https://via.placeholder.com/320x180/0A0A0A/FFFFFF?text=Social+Media+Ad'
                    }
                ]);
            }
            
        } catch (error) {
            console.error("Failed to fetch credits:", error);
            toast.error((error as Error).message || "Could not load credits.");
            setCredits('Error');
        }
        setLoading(false);
    };

    fetchData();

    // Listen for auth changes (optional, but good practice)
     const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
        setUser(session?.user ?? null)
        if (event === 'SIGNED_OUT') {
            setCredits('N/A');
            setPastVideos([]);
        }
        if (event === 'SIGNED_IN'){
             fetchData(); // Refetch data on sign in
        }
    })

    return () => {
        authListener?.subscription.unsubscribe()
    }

  }, [supabase]);

  if (loading) {
      return (
        <div className="space-y-8 content-container">
            <div className="flex justify-between items-center">
              <Skeleton className="h-14 w-64 bg-secondary/30" />
            </div>
            <Skeleton className="h-48 w-full bg-secondary/30" />
            <Skeleton className="h-12 w-1/3 bg-secondary/30" />
            <Skeleton className="h-64 w-full bg-secondary/30" />
        </div>
      );
  }

  if (!user) {
      return (
        <Card className="p-8 text-center content-container">
            <CardHeader>
                <CardTitle className="text-3xl md:text-4xl mb-2">Authentication Required</CardTitle>
                <CardDescription className="text-xl">Please sign in to access your dashboard</CardDescription>
            </CardHeader>
            <CardContent>
                <p className="mb-10 text-xl text-muted-foreground">Your creative journey is just a login away. Access your personalized dashboard to craft AI-powered videos for social media.</p>
                <div className="flex gap-6 justify-center">
                  <Link href="/">
                    <Button variant="outline" size="lg">Back to Home</Button>
                  </Link>
                  <Link href="/login">
                    <Button variant="default" size="lg">Sign In Now</Button>
                  </Link>
                </div>
            </CardContent>
        </Card>
      );
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(date);
  };

  // --- Edit Title Handlers ---
  const handleEditClick = (video: VideoCreation) => {
    setEditingVideoId(video.id);
    setEditingTitle(video.title || "");
  };

  const handleCancelEdit = () => {
    setEditingVideoId(null);
    setEditingTitle("");
  };

  const handleSaveTitle = async (videoId: string) => {
    if (!editingTitle.trim()) {
        toast.error("Title cannot be empty.");
        return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        toast.error("Authentication error.");
        return;
    }
    const token = session.access_token;

    try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/past-videos/${videoId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ title: editingTitle }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || "Failed to update title");
        }

        // Update local state
        setPastVideos(prevVideos => 
            prevVideos.map(video => 
                video.id === videoId ? { ...video, title: editingTitle } : video
            )
        );
        toast.success("Video title updated!");
        handleCancelEdit(); // Exit editing mode

    } catch (error) {
        console.error("Error saving title:", error);
        toast.error(`Error: ${(error as Error).message}`);
    }
  };
  // --- End Edit Title Handlers ---

  return (
     <div className="space-y-12 content-container py-12 md:py-16">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 pb-6 border-b border-border">
            <h1 className="text-4xl md:text-5xl font-bold text-gradient">Re<span className="text-foreground">Merge</span></h1>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
              <p className="text-lg md:text-xl whitespace-nowrap">Welcome, <span className="text-foreground font-medium">{user.email}</span></p>
              <div className="flex gap-3">
                <Link href="/">
                  <Button variant="outline" size="default">Home</Button>
                </Link>
                <Button variant="outline" size="default" onClick={handleSignOut}>Sign Out</Button>
              </div>
            </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <Card className="flex flex-col">
                <CardHeader>
                    <CardTitle className="text-2xl md:text-3xl">Your Creative Credits</CardTitle>
                    <CardDescription className="text-lg md:text-xl">Use credits to generate AI-powered videos</CardDescription>
                </CardHeader>
                <CardContent className="flex-grow space-y-4">
                    <p className="text-6xl md:text-8xl font-bold text-center py-6">{credits}</p>
                    <p className="text-lg md:text-xl text-muted-foreground text-center">Remaining credits for video generation</p>
                </CardContent>
                <CardFooter className="justify-center">
                    <Link href="/billing">
                        <Button variant="outline" size="lg">Upgrade Plan</Button>
                    </Link>
                </CardFooter>
             </Card>

             <Card className="flex flex-col">
                <CardHeader>
                    <CardTitle className="text-2xl md:text-3xl">Start Creating</CardTitle>
                    <CardDescription className="text-lg md:text-xl">Transform videos into viral content</CardDescription>
                </CardHeader>
                <CardContent className="flex-grow flex flex-col items-center justify-center text-center">
                    <div className="mb-8">
                        <p className="text-lg md:text-xl mb-4">Upload your video and portrait to begin.</p>
                        <p className="text-base md:text-lg text-muted-foreground mb-6">Our AI will generate a professional, shareable video in minutes!</p>
                    </div>
                </CardContent>
                <CardFooter className="flex justify-center">
                    <Link href="/generate">
                        <Button variant="default" size="lg" className="px-10 py-6 text-xl">
                            Create New Video
                        </Button>
                    </Link>
                </CardFooter>
             </Card>
         </div>

        <Separator />
        <div className="space-y-8">
            <h2 className="section-title">Your Video Collection</h2>
            <Card>
                <CardHeader>
                    <CardTitle className="text-2xl md:text-3xl">Past Creations</CardTitle>
                    <CardDescription className="text-lg md:text-xl">All your generated videos appear here</CardDescription>
                </CardHeader>
                <CardContent>
                    {pastVideos.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                            {pastVideos.map(video => (
                                <div key={video.id} className="bg-card/80 backdrop-blur-sm rounded-lg overflow-hidden border border-border transition-shadow hover:shadow-lg hover:border-primary/20">
                                    <div className="aspect-video bg-muted/20 relative">
                                        {video.thumbnail ? (
                                            <img 
                                                src={video.thumbnail} 
                                                alt={video.title || 'Video thumbnail'}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-muted/10">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground"><path d="m22 8-6-6H6a2 2 0 0 0-2 2v16c0 1.1.9 2 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M16 2v6h6"/><path d="M12 18v-6"/><path d="m9 15 3 3 3-3"/></svg>
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-5">
                                        {editingVideoId === video.id ? (
                                            <div className="flex items-center gap-2 mb-1">
                                                <Input 
                                                    type="text"
                                                    value={editingTitle}
                                                    onChange={(e) => setEditingTitle(e.target.value)}
                                                    onKeyDown={(e) => e.key === 'Enter' && handleSaveTitle(video.id)}
                                                    className="h-8 text-lg md:text-xl"
                                                    autoFocus
                                                />
                                                <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={() => handleSaveTitle(video.id)}><SaveIcon className="size-4" /></Button>
                                                <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={handleCancelEdit}><XIcon className="size-4" /></Button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 mb-1">
                                                 <h3 className="font-semibold text-lg md:text-xl truncate flex-grow">{video.title || "Untitled Video"}</h3>
                                                 <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={() => handleEditClick(video)}>
                                                     <Edit2Icon className="size-4 text-muted-foreground" />
                                                 </Button>
                                            </div>
                                        )}
                                        <p className="text-muted-foreground text-sm mb-4">{formatDate(video.created_at)}</p>
                                        <div className="flex justify-end gap-3">
                                            <a href={video.url} target="_blank" rel="noopener noreferrer">
                                                <Button variant="outline" size="sm">
                                                    Watch
                                                </Button>
                                            </a>
                                            <a href={video.url} download>
                                                <Button variant="outline" size="sm">
                                                    Download
                                                </Button>
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-16 border border-dashed border-border rounded-lg bg-muted/10">
                            <p className="text-xl text-muted-foreground mb-6">You haven't created any videos yet</p>
                            <Link href="/generate">
                                <Button variant="outline" size="lg" className="mt-4">Create Your First Video</Button>
                            </Link>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
        
        <Separator />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            <Card>
                <CardHeader>
                    <CardTitle className="text-xl md:text-2xl">Quick Tips</CardTitle>
                </CardHeader>
                <CardContent>
                    <ul className="space-y-3 list-disc list-inside text-base md:text-lg text-muted-foreground">
                        <li>Upload clear, well-lit portrait photos</li>
                        <li>Short videos (under 30 seconds) work best</li>
                        <li>Each generation uses 1 credit</li>
                        <li>Export directly to social media platforms</li>
                    </ul>
                </CardContent>
            </Card>
            
            <Card>
                <CardHeader>
                    <CardTitle className="text-xl md:text-2xl">Features</CardTitle>
                </CardHeader>
                <CardContent>
                    <ul className="space-y-3 list-disc list-inside text-base md:text-lg text-muted-foreground">
                        <li>AI-powered lip-sync technology</li>
                        <li>Custom voice generation</li>
                        <li>Multiple video templates</li>
                        <li>High-definition video output</li>
                    </ul>
                </CardContent>
            </Card>
            
            <Card>
                <CardHeader>
                    <CardTitle className="text-xl md:text-2xl">What's New</CardTitle>
                </CardHeader>
                <CardContent>
                    <ul className="space-y-3 list-disc list-inside text-base md:text-lg text-muted-foreground">
                        <li>Improved facial detection</li>
                        <li>New voice styles added</li>
                        <li>Faster processing times</li>
                        <li>Enhanced video quality</li>
                    </ul>
                </CardContent>
            </Card>
        </div>
     </div>
  );
} 