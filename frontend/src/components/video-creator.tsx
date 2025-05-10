'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { toast } from "sonner"
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel, SelectSeparator } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  ImageIcon,
  VideoIcon,
  RocketIcon,
  CheckCircleIcon,
  RefreshCwIcon,
  AlertCircleIcon,
  ArrowRightIcon,
  DownloadIcon,
  ExternalLinkIcon,
  UploadCloudIcon,
  CreditCard
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// Simple XHR upload function
async function uploadFileToS3(file: File, token: string, uploadType: 'video' | 'avatar'): Promise<{ upload_url: string, object_key: string }> {
  const apiUrl = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/upload-url`;
  const presignedUrlResponse = await fetch(apiUrl, { 
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ 
      filename: file.name,
      content_type: file.type || 'application/octet-stream',
      upload_type: uploadType
    }),
  })

  if (!presignedUrlResponse.ok) {
    let errorDetail = `Failed to get ${uploadType} upload URL: ${presignedUrlResponse.statusText}`;
    try {
      const errorData = await presignedUrlResponse.json()
      if (errorData && errorData.detail) {
        errorDetail = typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail);
      } 
    } catch (jsonError) {
      console.error(`Could not parse ${uploadType} error JSON:`, jsonError);
    }
    throw new Error(errorDetail)
  }

  const { upload_url, object_key } = await presignedUrlResponse.json()
  return { upload_url, object_key };
}

// Zero Credits Modal Component
function ZeroCreditsModal({ onClose, onUpgrade }: { onClose: () => void, onUpgrade: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md animate-in fade-in-0 zoom-in-95 duration-300">
        <CardHeader>
          <CardTitle className="flex items-center text-2xl">
            <CreditCard className="w-6 h-6 mr-2 text-primary" />
            You're out of credits
          </CardTitle>
          <CardDescription>
            You've used all your available credits for video generation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-4">
            Upgrade your plan to get more credits and continue creating amazing videos for your social media and marketing needs.
          </p>
          <div className="bg-primary/10 border border-primary/30 rounded-lg p-4 mb-4">
            <h3 className="font-medium text-lg mb-2">Pro tips:</h3>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Credits are renewed monthly with your subscription</li>
              <li>Each video uses 1 credit (approximately 1 minute of content)</li>
              <li>Higher plans offer better value per video</li>
            </ul>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={onClose}>
            Continue Browsing
          </Button>
          <Button onClick={onUpgrade} className="bg-gradient-primary hover:bg-gradient-primary-hover">
            <CreditCard className="w-4 h-4 mr-2" />
            Upgrade Now
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function VideoCreator() {
  // File upload states
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [isAvatarUploading, setIsAvatarUploading] = useState(false);
  const [avatarUploadProgress, setAvatarUploadProgress] = useState(0);
  const [uploadedAvatarKey, setUploadedAvatarKey] = useState<string | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [isVideoUploading, setIsVideoUploading] = useState(false);
  const [videoUploadProgress, setVideoUploadProgress] = useState(0);
  const [uploadedVideoKey, setUploadedVideoKey] = useState<string | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  
  // Generation state
  const [activeStep, setActiveStep] = useState<"upload" | "review" | "generating" | "result">("upload");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedJobId, setGeneratedJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<any>(null);
  const [pollingIntervalId, setPollingIntervalId] = useState<NodeJS.Timeout | null>(null);
  const [resultVideoUrl, setResultVideoUrl] = useState<string | null>(null);
  
  // Script states  
  const [editedScript, setEditedScript] = useState<string>("");
  const [scriptLoaded, setScriptLoaded] = useState<boolean>(false);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>("ZRwrL4id6j1HPGFkeCzO");
  const [regeneratePrompt, setRegeneratePrompt] = useState<string>("");
  const [isRegenerating, setIsRegenerating] = useState<boolean>(false);
  
  // Video ready notification states
  const [showVideoReadyNotification, setShowVideoReadyNotification] = useState<boolean>(false);
  
  // User credits state
  const [userCredits, setUserCredits] = useState<number | null>(null);
  // User plan state
  const [userPlan, setUserPlan] = useState<"free" | "creator" | "pro" | "growth">("free");
  
  // Zero credits modal state
  const [showZeroCreditsModal, setShowZeroCreditsModal] = useState<boolean>(false);
  
  const supabase = createClient();
  const router = useRouter();
  
  // Fetch user's current credit balance and plan
  useEffect(() => {
    const fetchUserCredits = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) return;
        
        const token = session.access_token;
        const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/credits`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          console.error("Failed to fetch user credits");
          return;
        }
        
        const data = await response.json();
        setUserCredits(data.credits);
        
        // Determine plan based on subscription data
        // This is a simplified approach - you might need to adjust based on your actual API response
        if (data.subscription?.plan) {
          setUserPlan(data.subscription.plan.toLowerCase());
        } else {
          // Default to free if no plan is specified
          setUserPlan("free");
        }
      } catch (error) {
        console.error("Error fetching user credits:", error);
      }
    };
    
    fetchUserCredits();
  }, [supabase]);
  
  // Clean up previews on unmount
  useEffect(() => {
    return () => {
      if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
      if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    };
  }, [avatarPreviewUrl, videoPreviewUrl]);
  
  // Handle avatar file selection
  const handleAvatarFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setAvatarFile(selectedFile);
      setUploadedAvatarKey(null);
      setAvatarUploadProgress(0);
      setAvatarPreviewUrl(URL.createObjectURL(selectedFile));
    }
  };
  
  // Handle video file selection
  const handleVideoFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setVideoFile(selectedFile);
      setUploadedVideoKey(null);
      setVideoUploadProgress(0);
      setVideoPreviewUrl(URL.createObjectURL(selectedFile));
    }
  };
  
  // XHR Upload with progress
  const performXhrUpload = (file: File, url: string, onProgress: (percent: number) => void): Promise<void> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', url, true);
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
      
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded * 100) / event.total);
          onProgress(percentComplete);
        }
      };
      
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`Upload failed: ${xhr.statusText || xhr.status}`));
        }
      };
      
      xhr.onerror = () => {
        reject(new Error("Upload failed due to network error."));
      };
      
      xhr.send(file);
    });
  };
  
  // Upload avatar file
  const handleUploadAvatar = async () => {
    if (!avatarFile) {
      toast.error("Please select a portrait image first.");
      return;
    }
    
    setIsAvatarUploading(true);
    setAvatarUploadProgress(0);
    
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error("Authentication error. Please log in again.");
      }
      const token = session.access_token;
      
      const { upload_url, object_key } = await uploadFileToS3(avatarFile, token, 'avatar');
      await performXhrUpload(avatarFile, upload_url, setAvatarUploadProgress);
      
      setUploadedAvatarKey(object_key);
      toast.success("Portrait image uploaded successfully!");
    } catch (error) {
      console.error("Avatar upload error:", error);
      toast.error(`Portrait Upload Failed: ${(error as Error).message}`);
    } finally {
      setIsAvatarUploading(false);
    }
  };
  
  // Upload video file
  const handleUploadVideo = async () => {
    if (!videoFile) {
      toast.error("Please select a video file first.");
      return;
    }
    
    setIsVideoUploading(true);
    setVideoUploadProgress(0);
    
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error("Authentication error. Please log in again.");
      }
      const token = session.access_token;
      
      const { upload_url, object_key } = await uploadFileToS3(videoFile, token, 'video');
      await performXhrUpload(videoFile, upload_url, setVideoUploadProgress);
      
      setUploadedVideoKey(object_key);
      toast.success("Video file uploaded successfully!");
    } catch (error) {
      console.error("Video upload error:", error);
      toast.error(`Video Upload Failed: ${(error as Error).message}`);
    } finally {
      setIsVideoUploading(false);
    }
  };
  
  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollingIntervalId) {
      clearInterval(pollingIntervalId);
      setPollingIntervalId(null);
    }
  }, [pollingIntervalId]);
  
  // Poll job status
  const pollJobStatus = useCallback(async (jobId: string, token: string) => {
    if (activeStep === "review" && !jobStatus?.final_url) { // Allow one final poll if final_url might be coming
      console.log("Currently in review, but allowing a check for final URL if status was recently completed.")
    }
    
    try {
      console.log(`[POLL STATUS] ⏱️ Checking job ${jobId} status. Current activeStep: ${activeStep}`);
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/job-status/${jobId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          console.log(`[POLL STATUS] Job ${jobId} not found yet (404), continuing poll.`);
          return; 
        }
        console.error(`[POLL STATUS] Failed to fetch job status (${response.status}) for job ${jobId}:`, await response.text());
        throw new Error(`Failed to fetch job status (${response.status})`);
      }
      
      const statusData = await response.json();
      console.log("[POLL STATUS] 📡 Raw status data received:", JSON.stringify(statusData));
      setJobStatus(statusData); // Update jobStatus state immediately
      
      // MOST CRITICAL PART: Check for completed Creatomate video
      if (statusData.status === 'completed' && statusData.final_url) {
        console.log("✅✅✅ [POLL STATUS] Backend confirms: FINAL URL VERIFIED AND VIDEO IS READY! ✅✅✅");
        console.log("[POLL STATUS] Final URL to display:", statusData.final_url);
        
        // --- FORCE VIDEO DISPLAY LOGIC ---
        setResultVideoUrl(statusData.final_url); 
        setActiveStep("result"); 
        setShowVideoReadyNotification(true); 
        
        toast.success("Video Ready! Displaying now...", {
          duration: 10000, // Increased duration
          position: "top-center",
          style: { background: 'linear-gradient(to right, #00b09b, #96c93d)', color: 'white', fontWeight: 'bold', fontSize: '1.1rem' },
        });
        
        console.log("[POLL STATUS] Stopping polling because video is completed and URL is present.");
        stopPolling(); 
        return; // Explicitly return after handling completion
      }
      
      // Handle pending review
      if (statusData.status === 'pending_review' && statusData.stage === 'script_ready_for_review') {
        console.log("[POLL STATUS] 📝 Script ready for review. Current scriptLoaded state:", scriptLoaded);
        if (!scriptLoaded && statusData.generated_script) {
          console.log("[POLL STATUS] Setting new script from backend.");
          setEditedScript(statusData.generated_script);
          setScriptLoaded(true);
        } else if (scriptLoaded) {
          console.log("[POLL STATUS] Script already loaded, not overwriting user edits.");
        }
        // Only switch to review if not already generating/continued
        if (activeStep !== "generating") {
          setActiveStep("review");
          // Note: We no longer stop polling here to avoid missing status transitions after user continues.
        }
        return; // Explicitly return, but polling continues via interval
      }
      
      // Handle failed status
      if (statusData.status === 'failed') {
        console.error("[POLL STATUS] ❌ Generation failed:", statusData.error_message);
        toast.error(`Generation failed: ${statusData.error_message || 'Unknown error'}`, { duration: 7000 });
        setActiveStep("upload"); // Or some other appropriate step
        console.log("[POLL STATUS] Stopping polling due to failure.");
        stopPolling();
        return; // Explicitly return
      }
      
      // Handle interim processing stages
      if (statusData.status === 'processing') {
        console.log(`[POLL STATUS] ⏳ Job still processing. Stage: ${statusData.stage}`);
        if (statusData.stage === "verifying_url") {
          console.log("[POLL STATUS] 🔍 URL verification in progress by backend...");
          toast.info("Verifying final video URL... Almost there!", { position: "top-center" });
        }
      } else {
        console.log(`[POLL STATUS] ⏳ Job status is '${statusData.status}', stage is '${statusData.stage}'. Continuing to poll.`);
      }

    } catch (error) {
      console.error("[POLL STATUS] Error in pollJobStatus function:", error);
      toast.error(`Critical error checking status: ${(error as Error).message}`);
      // Optionally stop polling on repeated critical errors to prevent spam
      // stopPolling(); 
    }
  }, [activeStep, scriptLoaded, stopPolling]); // Removed jobStatus from dependencies as it's set inside
  
  // Start polling job status
  const startPollingJobStatus = useCallback((jobId: string, token: string) => {
    // Clear any existing polling
    if (pollingIntervalId) {
      clearInterval(pollingIntervalId);
      setPollingIntervalId(null);
    }
    
    console.log("🚀 STARTING TO POLL FOR VIDEO STATUS - Job ID:", jobId);
    
    // Execute one poll immediately
    pollJobStatus(jobId, token);
    
    // Always set up regular polling; a separate effect will stop it when appropriate
    const intervalId = setInterval(() => {
      console.log("📊 Polling job status...");
      pollJobStatus(jobId, token);
    }, 2000); // Poll every 2 seconds for faster updates

    setPollingIntervalId(intervalId);
  }, [pollingIntervalId, pollJobStatus]);
  
  // Effect to ensure polling is stopped when step changes to review
  useEffect(() => {
    if (activeStep === "review") {
      stopPolling();
    }
  }, [activeStep, stopPolling]);
  
  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalId) {
        clearInterval(pollingIntervalId);
      }
    };
  }, [pollingIntervalId]);
  
  // AGGRESSIVE STATE SYNC: Effect to force result view when job is complete and URL is available
  useEffect(() => {
    console.log("[EFFECT SYNC] Checking jobStatus for completion:", JSON.stringify(jobStatus));
    if (jobStatus?.status === 'completed' && jobStatus?.final_url) {
      console.log("[EFFECT SYNC] ✅ Job is COMPLETED with a final URL. Current activeStep:", activeStep);
      if (activeStep !== "result") {
        console.log("[EFFECT SYNC] Forcing activeStep to 'result' and setting resultVideoUrl.");
        setResultVideoUrl(jobStatus.final_url); // Ensure URL is set first
        setActiveStep("result");
        setShowVideoReadyNotification(true); // Ensure notification banner shows
        toast.info("Video ready! Transitioning to results by EFFECT SYNC.", { duration: 5000 });
      } else {
        console.log("[EFFECT SYNC] Already in result step, ensuring resultVideoUrl is current.");
        if (resultVideoUrl !== jobStatus.final_url) {
          setResultVideoUrl(jobStatus.final_url); // Update if somehow different
        }
      }
      // We might also want to stop polling here again, just in case
      if (pollingIntervalId) {
        console.log("[EFFECT SYNC] Stopping any lingering polling.");
        stopPolling();
      }
    } else {
      console.log("[EFFECT SYNC] Job not yet completed or final_url missing.",
                  `Status: ${jobStatus?.status}, URL: ${jobStatus?.final_url ? 'present' : 'missing'}`);
    }
  }, [jobStatus, activeStep, resultVideoUrl, stopPolling, pollingIntervalId]); // Added resultVideoUrl, stopPolling, pollingIntervalId
  
  // Handle generation start
  const handleStartGeneration = async () => {
    if (!uploadedAvatarKey) {
      toast.error("Please upload a portrait image first.");
      return;
    }
    
    try {
      // Get latest credit balance before proceeding
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error("Authentication error. Please log in again.");
      }
      const token = session.access_token;
      
      // Check current credit balance
      const creditsResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/credits`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!creditsResponse.ok) {
        const errorData = await creditsResponse.json().catch(() => ({}));
        throw new Error(errorData.detail || "Failed to check credits balance");
      }
      
      const creditsData = await creditsResponse.json();
      setUserCredits(creditsData.credits);
      
      // If user has no credits, show the zero credits modal
      if (creditsData.credits <= 0) {
        setShowZeroCreditsModal(true);
        return;
      }
      
      // Proceed with generation if credits are available
      setIsGenerating(true);
      setGeneratedJobId(null);
      setJobStatus(null);
      setResultVideoUrl(null);
      setScriptLoaded(false);
      setActiveStep("generating");
      stopPolling();
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/generate-meme`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          avatar_s3_key: uploadedAvatarKey,
          video_s3_key: uploadedVideoKey
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to start generation");
      }
      
      const result = await response.json();
      setGeneratedJobId(result.job_id);
      toast.success("Video generation started!");
      
      // After successful generation request, decrement local credit count
      setUserCredits(prev => prev !== null ? prev - 1 : null);
      
      // Start polling for status updates
      startPollingJobStatus(result.job_id, token);
      
    } catch (error) {
      console.error("Generation start error:", error);
      toast.error(`Generation failed: ${(error as Error).message}`);
      setActiveStep("upload");
    } finally {
      setIsGenerating(false);
    }
  };
  
  // Handle continue generation after script review
  const handleContinueGeneration = async () => {
    if (!generatedJobId || !editedScript) {
      toast.error("Missing job ID or script.");
      return;
    }
    
    setIsGenerating(true);
    setActiveStep("generating");
    stopPolling();
    
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error("Authentication error. Please log in again.");
      }
      const token = session.access_token;
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/continue-generation/${generatedJobId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          script: editedScript,
          voice_id: selectedVoiceId
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to continue generation");
      }
      
      toast.success("Generation continuing!");
      
      // Start polling again
      startPollingJobStatus(generatedJobId, token);
      
    } catch (error) {
      console.error("Generation continuation error:", error);
      toast.error(`Continuation failed: ${(error as Error).message}`);
      setActiveStep("review");
    } finally {
      setIsGenerating(false);
    }
  };
  
  // Handle script regeneration
  const handleRegenerateScript = async () => {
    if (!regeneratePrompt.trim()) {
      toast.error("Please enter a prompt for regeneration.");
      return;
    }
    
    setIsRegenerating(true);
    
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error("Authentication error. Please log in again.");
      }
      const token = session.access_token;
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/regenerate-script`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          current_script: editedScript,
          prompt: regeneratePrompt,
          context: jobStatus?.summary
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to regenerate script");
      }
      
      const data = await response.json();
      // Update the script with the regenerated one
      setEditedScript(data.regenerated_script);
      setRegeneratePrompt("");
      toast.success("Script successfully enhanced!");
      
    } catch (error) {
      console.error("Script regeneration error:", error);
      toast.error(`Script regeneration failed: ${(error as Error).message}`);
    } finally {
      setIsRegenerating(false);
    }
  };
  
  // Handle video ready refresh
  const handleRefreshVideo = async () => {
    if (!generatedJobId) return;
    
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error("Authentication error. Please log in again.");
      }
      const token = session.access_token;
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/job-status/${generatedJobId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to refresh video status (${response.status})`);
      }
      
      const statusData = await response.json();
      setJobStatus(statusData);
      
      if (statusData.status === 'completed' && statusData.final_url) {
        setResultVideoUrl(statusData.final_url);
        setActiveStep("result");
        setShowVideoReadyNotification(false);
      }
      
    } catch (error) {
      console.error("Video refresh error:", error);
      toast.error(`Failed to refresh: ${(error as Error).message}`);
    }
  };
  
  // Handle video download
  const handleDownloadVideo = async () => {
    if (!resultVideoUrl) return;
    try {
      toast.info("Preparing download...", { duration: 2000 });
      const response = await fetch(resultVideoUrl, { credentials: 'omit' });
      if (!response.ok) throw new Error('Failed to fetch video for download.');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `remerge-video-${generatedJobId || Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 100);
      toast.success("Download started!");
    } catch (err) {
      console.error('Download error:', err);
      toast.error("Failed to download video. Please try again.");
    }
  };
  
  // Render generation progress bar and status
  const renderGenerationProgress = () => {
    if (!jobStatus) return null;
    
    // Fallback: If we have a resultVideoUrl, we should be in a completed state visually
    if (resultVideoUrl && activeStep === "result") {
        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                <span className="font-medium text-lg text-green-500">Video Completed!</span>
                <span className="text-green-500">100%</span>
                </div>
                <Progress value={100} className="h-2 [&>*]:bg-green-500" />
            </div>
        );
    }
    
    const getProgressValue = () => {
      const status = jobStatus.status;
      const stage = jobStatus.stage;
      
      if (status === 'pending_review') return 40;
      if (status === 'completed') return 100;
      if (status === 'failed' || status === 'error') return 0;
      
      if (status === 'processing') {
        if (stage === 'generating_script') return 30;
        if (stage === 'voice_synthesis' || stage === 'lip_syncing' || stage?.startsWith('lip_sync_polling')) return 50;
        if (stage === 'rendering_final') return 70;
        if (stage === 'verifying_url') return 90;
        return 50;
      }
      
      return 10; // default for queued/pending
    };
    
    const getStatusText = () => {
      const status = jobStatus.status;
      const stage = jobStatus.stage;
      
      // Fallback for completed state if resultVideoUrl is present
      if (resultVideoUrl && status === 'completed') return 'Video Completed!';
      
      if (status === 'pending_review') return 'Script Ready for Review';
      if (status === 'completed') return 'Completed';
      if (status === 'failed') return 'Failed';
      if (status === 'error') return 'Error';
      
      if (status === 'processing') {
        if (stage === 'generating_script') return 'Generating Script';
        if (stage === 'voice_synthesis') return 'Synthesizing Voice';
        if (stage === 'lip_syncing' || stage?.startsWith('lip_sync_polling')) return 'Creating Lip Sync';
        if (stage === 'rendering_final') return 'Rendering Video';
        if (stage === 'verifying_url') return 'Finalizing';
        return 'Processing';
      }
      
      return 'Queued';
    };
    
    const progressValue = getProgressValue();
    const statusText = getStatusText();
    
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="font-medium text-lg">{statusText}</span>
          <span>{progressValue}%</span>
        </div>
        <Progress value={progressValue} className="h-2" />
        
        {jobStatus.status === 'failed' && (
          <Alert variant="destructive">
            <AlertCircleIcon className="h-4 w-4" />
            <AlertTitle>Generation Failed</AlertTitle>
            <AlertDescription>
              {jobStatus.error_message || 'An unknown error occurred'}
            </AlertDescription>
          </Alert>
        )}
      </div>
    );
  };

  // Check if a voice is available for the current plan
  const isVoiceAvailable = (voiceCategory: "basic" | "creator" | "premium") => {
    switch (voiceCategory) {
      case "basic":
        // Basic voices are available on all plans
        return true;
      case "creator":
        // Creator voices are available on creator, pro, and growth plans
        return userPlan === "creator" || userPlan === "pro" || userPlan === "growth";
      case "premium":
        // Premium voices are available only on pro and growth plans
        return userPlan === "pro" || userPlan === "growth";
      default:
        return false;
    }
  };

  return (
    <div className="space-y-8">
      {/* Zero Credits Modal */}
      {showZeroCreditsModal && (
        <ZeroCreditsModal 
          onClose={() => setShowZeroCreditsModal(false)}
          onUpgrade={() => {
            setShowZeroCreditsModal(false);
            router.push('/billing');
          }}
        />
      )}
    
      {/* Video Ready Notification Banner */}
      {showVideoReadyNotification && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/80 z-50">
          <div className="max-w-2xl w-full mx-auto p-8 bg-gradient-to-r from-green-500 to-blue-500 rounded-xl shadow-xl text-white text-center">
            <CheckCircleIcon className="h-16 w-16 mx-auto mb-4" />
            <h2 className="text-3xl font-bold mb-2">VIDEO READY!</h2>
            <p className="text-xl mb-6">Your video has been generated successfully and is ready to view!</p>
            <div className="flex justify-center gap-4">
              <Button 
                onClick={() => {
                  setActiveStep("result");
                  setShowVideoReadyNotification(false);
                }}
                size="lg"
                className="bg-white text-green-700 hover:bg-gray-100 shadow-lg"
              >
                View My Video Now
              </Button>
            </div>
          </div>
        </div>
      )}
    
      {/* Main Content */}
      <Card className="border-border/30 bg-card/70 backdrop-blur-md shadow-lg">
        <CardHeader className="border-b border-border/20">
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl">Video Creation</CardTitle>
            <div className="flex items-center space-x-1 rounded-full bg-muted/50 px-3 py-1 text-xs font-medium">
              <div className={`size-2 rounded-full ${activeStep === "upload" ? "bg-primary" : "bg-muted-foreground/30"}`} />
              <div className={`size-2 rounded-full ${activeStep === "review" ? "bg-primary" : "bg-muted-foreground/30"}`} />
              <div className={`size-2 rounded-full ${activeStep === "generating" ? "bg-primary" : "bg-muted-foreground/30"}`} />
              <div className={`size-2 rounded-full ${activeStep === "result" ? "bg-primary" : "bg-muted-foreground/30"}`} />
            </div>
          </div>
          <CardDescription>
            {activeStep === "upload" && "Upload your portrait and optional video"}
            {activeStep === "review" && "Review and edit the generated script"}
            {activeStep === "generating" && "Your video is being generated"}
            {activeStep === "result" && "Your video is ready to view and download"}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="pt-6">
          {/* Upload Step */}
          {activeStep === "upload" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Portrait Upload */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium flex items-center">
                    <ImageIcon className="mr-2 h-5 w-5 text-primary" />
                    <span>Portrait Image</span>
                    <span className="ml-2 text-xs text-destructive">*</span>
                  </h3>
                </div>
                
                <div 
                  className="border-2 border-dashed border-border/40 rounded-lg p-4 text-center hover:border-primary/50 transition-all cursor-pointer bg-card/50"
                  onClick={() => avatarInputRef.current?.click()}
                >
                  <Input 
                    type="file" 
                    ref={avatarInputRef} 
                    onChange={handleAvatarFileChange} 
                    className="hidden"
                    accept="image/jpeg,image/png,image/gif,image/webp" 
                  />
                  
                  {avatarPreviewUrl ? (
                    <div className="relative">
                      <img 
                        src={avatarPreviewUrl} 
                        alt="Portrait Preview" 
                        className="max-h-48 mx-auto rounded-md"
                      />
                      {!isAvatarUploading && uploadedAvatarKey && (
                        <div className="absolute top-2 right-2 bg-green-500/80 text-white p-1 rounded-full">
                          <CheckCircleIcon className="h-5 w-5" />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="py-8 flex flex-col items-center text-muted-foreground">
                      <UploadCloudIcon className="h-10 w-10 mb-2" />
                      <p>Upload a portrait image</p>
                      <p className="text-xs mt-1">JPG, PNG, GIF up to 5MB</p>
                    </div>
                  )}
                  
                  {avatarFile && !uploadedAvatarKey && (
                    <div className="mt-4">
                      {isAvatarUploading ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-center gap-2">
                            <span className="text-sm">Uploading...</span>
                            <span className="text-sm font-medium">{avatarUploadProgress}%</span>
                          </div>
                          <Progress value={avatarUploadProgress} className="h-1" />
                        </div>
                      ) : (
                        <Button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleUploadAvatar(); }}
                          variant="outline"
                          size="sm"
                        >
                          Upload Portrait
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Video Upload - Optional */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium flex items-center">
                  <VideoIcon className="mr-2 h-5 w-5 text-primary" />
                  <span>Background Video</span>
                  <span className="ml-2 text-xs text-muted-foreground">(Optional)</span>
                </h3>
                
                <div 
                  className="border-2 border-dashed border-border/40 rounded-lg p-4 text-center hover:border-primary/50 transition-all cursor-pointer bg-card/50"
                  onClick={() => videoInputRef.current?.click()}
                >
                  <Input 
                    type="file" 
                    ref={videoInputRef} 
                    onChange={handleVideoFileChange} 
                    className="hidden"
                    accept="video/mp4,video/webm,video/quicktime" 
                  />
                  
                  {videoPreviewUrl ? (
                    <div className="relative">
                      <video 
                        src={videoPreviewUrl} 
                        controls
                        className="max-h-48 mx-auto rounded-md"
                      />
                      {!isVideoUploading && uploadedVideoKey && (
                        <div className="absolute top-2 right-2 bg-green-500/80 text-white p-1 rounded-full">
                          <CheckCircleIcon className="h-5 w-5" />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="py-8 flex flex-col items-center text-muted-foreground">
                      <UploadCloudIcon className="h-10 w-10 mb-2" />
                      <p>Upload a background video</p>
                      <p className="text-xs mt-1">MP4, WebM up to 20MB</p>
                    </div>
                  )}
                  
                  {videoFile && !uploadedVideoKey && (
                    <div className="mt-4">
                      {isVideoUploading ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-center gap-2">
                            <span className="text-sm">Uploading...</span>
                            <span className="text-sm font-medium">{videoUploadProgress}%</span>
                          </div>
                          <Progress value={videoUploadProgress} className="h-1" />
                        </div>
                      ) : (
                        <Button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleUploadVideo(); }}
                          variant="outline"
                          size="sm"
                        >
                          Upload Video
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Credits Display */}
              <div className="col-span-1 lg:col-span-2 mt-4">
                <div className="flex items-center justify-between border-2 border-border p-4 rounded-md bg-card/70">
                  <div>
                    <h3 className="text-lg font-medium">Available Credits</h3>
                    <p className="text-sm text-muted-foreground">Each video uses 1 credit</p>
                  </div>
                  <div className="flex items-center">
                    <span className="text-2xl font-bold mr-2">{userCredits !== null ? userCredits : '...'}</span>
                    <Link href="/billing">
                      <Button variant="outline" size="sm" className="ml-2">
                        Get More
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Script Review Step */}
          {activeStep === "review" && (
            <div className="space-y-6 w-full">
              <div className="space-y-2">
                <Label htmlFor="script-editor" className="text-lg font-medium">Edit Script</Label>
                <Textarea 
                  id="script-editor"
                  value={editedScript}
                  onChange={(e) => setEditedScript(e.target.value)}
                  className="h-48 w-full border-2 border-border/50 bg-card/50 text-base p-4 resize-none"
                  placeholder="Loading script..."
                />
              </div>
              
              <div className="bg-primary/5 border-2 border-primary/20 rounded-lg p-4 space-y-3">
                <h3 className="font-medium flex items-center">
                  <RocketIcon className="mr-2 h-4 w-4 text-primary" />
                  <span>AI Script Enhancement</span>
                </h3>
                <div className="grid gap-3">
                  <Textarea
                    placeholder="E.g., Make it funnier, add more details, etc."
                    value={regeneratePrompt}
                    onChange={(e) => setRegeneratePrompt(e.target.value)}
                    className="min-h-8 border-2 border-border/40 bg-card/70 p-3"
                  />
                  <Button
                    onClick={handleRegenerateScript}
                    disabled={isRegenerating || !regeneratePrompt.trim()}
                    variant="outline"
                    className="bg-primary/10 hover:bg-primary/20 text-foreground"
                  >
                    {isRegenerating ? "Enhancing..." : "Enhance with AI"}
                  </Button>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label className="text-lg font-medium">Select Voice</Label>
                <Select 
                  value={selectedVoiceId} 
                  onValueChange={setSelectedVoiceId}
                >
                  <SelectTrigger className="border-2 border-border/50 bg-card/50">
                    <SelectValue placeholder="Select a voice" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    <SelectGroup>
                      <SelectLabel>Basic Voices (Free Plan)</SelectLabel>
                      <SelectItem value="ZRwrL4id6j1HPGFkeCzO">Sam - American male (Default)</SelectItem>
                      <SelectItem value="NFG5qt843uXKj4pFvR7C">Adam - British male</SelectItem>
                      <SelectItem value="CBHdTdZwkV4jYoCyMV1B">African American - Female</SelectItem>
                      <SelectItem value="gYr8yTP0q4RkX1HnzQfX">African American - Male</SelectItem>
                      <SelectItem value="LXVY607YcjqxFS3mcult">Alex - Male</SelectItem>
                      <SelectItem value="ZF6FPAbjXT4488VcRRnw">Amelia - British female</SelectItem>
                    </SelectGroup>
                    
                    <SelectSeparator />
                    
                    <SelectGroup>
                      <SelectLabel>Creator Plan Voices</SelectLabel>
                      <SelectItem 
                        value="ZkXXWlhJO3CtSXof2ujN"
                        disabled={!isVoiceAvailable("creator")}
                      >
                        Ava - American female
                      </SelectItem>
                      <SelectItem 
                        value="JBFqnCBsd6RMkjVDRZzb"
                        disabled={!isVoiceAvailable("creator")}
                      >
                        George - British male
                      </SelectItem>
                      <SelectItem 
                        value="i4CzbCVWoqvD0P1QJCUL"
                        disabled={!isVoiceAvailable("creator")}
                      >
                        Ivy - American female
                      </SelectItem>
                      <SelectItem 
                        value="7p1Ofvcwsv7UBPoFNcpI"
                        disabled={!isVoiceAvailable("creator")}
                      >
                        Julian - British male
                      </SelectItem>
                      <SelectItem 
                        value="JEAgwU0JZFGxl2KjC3if"
                        disabled={!isVoiceAvailable("creator")}
                      >
                        Maribeth - American female
                      </SelectItem>
                      <SelectItem 
                        value="FMQtISLdv5RvjpHBgf60"
                        disabled={!isVoiceAvailable("creator")}
                      >
                        Neil - British male
                      </SelectItem>
                      <SelectItem 
                        value="hKUnzqLzU3P9IVhYHREu"
                        disabled={!isVoiceAvailable("creator")}
                      >
                        Tex - American male
                      </SelectItem>
                      <SelectItem 
                        value="rCuVrCHOUMY3OwyJBJym"
                        disabled={!isVoiceAvailable("creator")}
                      >
                        Mia - Raspy American female
                      </SelectItem>
                      <SelectItem 
                        value="LtPsVjX1k0Kl4StEMZPK"
                        disabled={!isVoiceAvailable("creator")}
                      >
                        Sophia - Female
                      </SelectItem>
                      <SelectItem 
                        value="luVEyhT3CocLZaLBps8v"
                        disabled={!isVoiceAvailable("creator")}
                      >
                        Vivian - Australian Female
                      </SelectItem>
                    </SelectGroup>
                    
                    <SelectSeparator />
                    
                    <SelectGroup>
                      <SelectLabel>Premium Voices (Pro & Growth Plans)</SelectLabel>
                      <SelectItem 
                        value="41534e16-2966-4c6b-9670-111411def906"
                        disabled={!isVoiceAvailable("premium")}
                      >
                        1920s Radioman
                      </SelectItem>
                      <SelectItem 
                        value="NYC9WEgkq1u4jiqBseQ9"
                        disabled={!isVoiceAvailable("premium")}
                      >
                        Announcer - British man
                      </SelectItem>
                      <SelectItem 
                        value="L0Dsvb3SLTyegXwtm47J"
                        disabled={!isVoiceAvailable("premium")}
                      >
                        Archer - British male
                      </SelectItem>
                      <SelectItem value="kPzsL2i3teMYv0FxEYQ6" disabled={!isVoiceAvailable("premium")}>Brittney - American female</SelectItem>
                      <SelectItem value="PDJZDHevWkwdKwWFKj34" disabled={!isVoiceAvailable("premium")}>Cartoon Kid</SelectItem>
                      <SelectItem value="ngiiW8FFLIdMew1cqwSB" disabled={!isVoiceAvailable("premium")}>Chinese American - Female</SelectItem>
                      <SelectItem value="gAMZphRyrWJnLMDnom6H" disabled={!isVoiceAvailable("premium")}>Chinese American - Male</SelectItem>
                      <SelectItem value="qNkzaJoHLLdpvgh5tISm" disabled={!isVoiceAvailable("premium")}>Cowboy</SelectItem>
                      <SelectItem value="FVQMzxJGPUBtfz1Azdoy" disabled={!isVoiceAvailable("premium")}>Danielle - American female</SelectItem>
                      <SelectItem value="L5Oo1OjjHdbIvJDQFgmN" disabled={!isVoiceAvailable("premium")}>Demon Bartholomeus</SelectItem>
                      <SelectItem value="vfaqCOvlrKi4Zp7C2IAm" disabled={!isVoiceAvailable("premium")}>Demon Monster</SelectItem>
                      <SelectItem value="eVItLK1UvXctxuaRV2Oq" disabled={!isVoiceAvailable("premium")}>Femme Fetale - Female</SelectItem>
                      <SelectItem value="txtf1EDouKke753vN8SL" disabled={!isVoiceAvailable("premium")}>French - Female</SelectItem>
                      <SelectItem value="IHngRooVccHyPqB4uQkG" disabled={!isVoiceAvailable("premium")}>French - Male</SelectItem>
                      <SelectItem value="AnvlJBAqSLDzEevYr9Ap" disabled={!isVoiceAvailable("premium")}>German - Female</SelectItem>
                      <SelectItem value="NOpBlnGInO9m6vDvFkFC" disabled={!isVoiceAvailable("premium")}>Grandpa - American</SelectItem>
                      <SelectItem value="c99d36f3-5ffd-4253-803a-535c1bc9c306" disabled={!isVoiceAvailable("premium")}>Griffin</SelectItem>
                      <SelectItem value="BY77WcifAQZkoI7EftFd" disabled={!isVoiceAvailable("premium")}>Indian - Female</SelectItem>
                      <SelectItem value="siw1N9V8LmYeEWKyWBxv" disabled={!isVoiceAvailable("premium")}>Indian - Male</SelectItem>
                      <SelectItem value="BZc8d1MPTdZkyGbE9Sin" disabled={!isVoiceAvailable("premium")}>Italian - Female</SelectItem>
                      <SelectItem value="t3hJ92dgZhDVtsff084B" disabled={!isVoiceAvailable("premium")}>Italian - Male</SelectItem>
                      <SelectItem value="pO3rCaEbT3xVc0h3pPoG" disabled={!isVoiceAvailable("premium")}>Ivan the Mighty</SelectItem>
                      <SelectItem value="cccc21e8-5bcf-4ff0-bc7f-be4e40afc544" disabled={!isVoiceAvailable("premium")}>Little Gaming Girl</SelectItem>
                      <SelectItem value="50d6beb4-80ea-4802-8387-6c948fe84208" disabled={!isVoiceAvailable("premium")}>Merchant</SelectItem>
                      <SelectItem value="A8rwEcJwudjohY1gjPfa" disabled={!isVoiceAvailable("premium")}>Nigerian - Female</SelectItem>
                      <SelectItem value="236bb1fb-dc41-4a2b-84d6-d22d2a2aaae1" disabled={!isVoiceAvailable("premium")}>Old Timey Radioman</SelectItem>
                      <SelectItem value="JoYo65swyP8hH6fVMeTO" disabled={!isVoiceAvailable("premium")}>Old Wizard</SelectItem>
                      <SelectItem value="224126de-034c-429b-9fde-71031fba9a59" disabled={!isVoiceAvailable("premium")}>Overlord</SelectItem>
                      <SelectItem value="8f091740-3df1-4795-8bd9-dc62d88e5131" disabled={!isVoiceAvailable("premium")}>Princess</SelectItem>
                      <SelectItem value="185c2177-de10-4848-9c0a-ae6315ac1493" disabled={!isVoiceAvailable("premium")}>Robotic Male</SelectItem>
                      <SelectItem value="gbLy9ep70G3JW53cTzFC" disabled={!isVoiceAvailable("premium")}>Romanian - Female</SelectItem>
                      <SelectItem value="LT7npgnEogysurF7U8GR" disabled={!isVoiceAvailable("premium")}>Rosie - Young girl</SelectItem>
                      <SelectItem value="bf0a246a-8642-498a-9950-80c35e9276b5" disabled={!isVoiceAvailable("premium")}>Sophie</SelectItem>
                      <SelectItem value="sTgjlXyTKe3nwbzzjDAZ" disabled={!isVoiceAvailable("premium")}>Southern Accent - Male</SelectItem>
                      <SelectItem value="d7862948-75c3-4c7c-ae28-2959fe166f49" disabled={!isVoiceAvailable("premium")}>The Oracle</SelectItem>
                      <SelectItem value="bn5HJAJ1igu4dFplCXkQ" disabled={!isVoiceAvailable("premium")}>Toddler</SelectItem>
                      <SelectItem value="mLJVsC2pwqCmmrBUAzg6" disabled={!isVoiceAvailable("premium")}>Vallerie - Old British female</SelectItem>
                      <SelectItem value="flHkNRp1BlvT73UL6gyz" disabled={!isVoiceAvailable("premium")}>Villain - Female</SelectItem>
                      <SelectItem value="INDKfphIpZiLCUiXae4o" disabled={!isVoiceAvailable("premium")}>Villain - Male</SelectItem>
                      <SelectItem value="nbk2esDn4RRk4cVDdoiE" disabled={!isVoiceAvailable("premium")}>Whispering - Female</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Free plan: 6 basic voices | Creator plan: 16 voices | Pro & Growth plans: All voices
                </p>
                {userPlan === "free" && (
                  <p className="text-xs text-primary mt-1">
                    <Link href="/billing" className="underline">Upgrade your plan</Link> to unlock additional voice options
                  </p>
                )}
              </div>
            </div>
          )}
          
          {/* Generation Status */}
          {activeStep === "generating" && (
            <div className="space-y-6">
              <div className="rounded-lg border border-border/50 bg-card/50 p-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="animate-spin rounded-full size-5 border-2 border-primary border-t-transparent" />
                  <h3 className="font-medium">Creating Your Video</h3>
                </div>
                
                {renderGenerationProgress()}
                
                {jobStatus?.status === 'completed' && resultVideoUrl && (
                  <Alert className="mt-4 bg-green-500/10 border-green-500/30 text-green-500">
                    <div className="flex items-center">
                      <CheckCircleIcon className="h-4 w-4 mr-2" />
                      <span>Video is ready! Loading it now...</span>
                    </div>
                  </Alert>
                )}
                
                {jobStatus?.stage === "verifying_url" && (
                  <Alert className="mt-4 bg-cyan-500/10 border-cyan-500/30 text-cyan-400">
                    <div className="flex items-center">
                      <RefreshCwIcon className="h-4 w-4 animate-spin mr-2" />
                      <span className="font-bold"> FINAL VIDEO ALMOST READY! Please wait...</span>
                    </div>
                  </Alert>
                )}
              </div>
              
              <div className="text-sm text-muted-foreground">
                <p>Generation typically takes 1-3 minutes. Please wait while we:</p>
                <ul className="list-disc ml-5 mt-2 space-y-1">
                  <li className={jobStatus?.stage === "generating_script" ? "text-primary font-medium" : ""}>Generate script with AI</li>
                  <li className={jobStatus?.stage === "voice_synthesis" ? "text-primary font-medium" : ""}>Synthesize voice audio</li>
                  <li className={jobStatus?.stage?.includes("lip_sync") ? "text-primary font-medium" : ""}>Create lip-synced animation</li>
                  <li className={jobStatus?.stage === "rendering_final" ? "text-primary font-medium" : ""}>Render final video</li>
                  <li className={jobStatus?.stage === "verifying_url" ? "text-primary font-medium text-lg" : ""}>FINALIZING VIDEO</li>
                </ul>
              </div>
            </div>
          )}
          
          {/* Result Step */}
          {activeStep === "result" && (
            <div className="space-y-6">
              <Alert className="bg-green-100 border-2 border-green-500 text-green-700 p-4 rounded-lg shadow-md">
                <div className="flex items-center">
                    <CheckCircleIcon className="h-6 w-6 mr-3" />
                    <div>
                        <AlertTitle className="text-xl font-bold">Video Ready!</AlertTitle>
                        <AlertDescription className="text-md">
                        Your video has been successfully generated. View and download below.
                        </AlertDescription>
                    </div>
                </div>
              </Alert>

              {resultVideoUrl ? (
                <div className="aspect-video rounded-lg overflow-hidden border-4 border-green-500 bg-black shadow-2xl">
                  <video 
                    key={resultVideoUrl}
                    src={resultVideoUrl} 
                    controls 
                    autoPlay
                    playsInline
                    className="w-full h-full"
                    onLoadedData={() => console.log("Video player has loaded data for:", resultVideoUrl)}
                    onError={(e) => console.error("Video player error:", e)}
                  />
                </div>
              ) : (
                <div className="aspect-video rounded-lg border border-border/30 bg-card/50 flex items-center justify-center">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary border-t-transparent mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Loading video...</p>
                  </div>
                </div>
              )}
              
              <div className="flex flex-wrap items-center gap-3">
                <Button 
                  onClick={handleDownloadVideo}
                  disabled={!resultVideoUrl}
                  className="flex items-center"
                >
                  <DownloadIcon className="mr-2 h-4 w-4" />
                  <span>Download</span>
                </Button>
                
                <Button 
                  variant="outline"
                  onClick={() => resultVideoUrl && window.open(resultVideoUrl, '_blank')}
                  disabled={!resultVideoUrl}
                  className="flex items-center"
                >
                  <ExternalLinkIcon className="mr-2 h-4 w-4" />
                  <span>Open in New Tab</span>
                </Button>
                
                <Button 
                  variant="outline"
                  onClick={() => setActiveStep("upload")}
                  className="ml-auto"
                >
                  Create Another Video
                </Button>
              </div>
            </div>
          )}
        </CardContent>
        
        <CardFooter className="border-t border-border/20 flex justify-between pt-6">
          {activeStep === "upload" && (
            <div className="flex justify-end w-full">
              <Button 
                onClick={handleStartGeneration}
                disabled={!uploadedAvatarKey || isGenerating}
                size="lg"
                className="bg-gradient-primary hover:bg-gradient-primary-hover"
              >
                <span className="flex items-center gap-2">
                  <span>Start Generation</span>
                  <ArrowRightIcon className="h-4 w-4" />
                </span>
              </Button>
            </div>
          )}
          
          {activeStep === "review" && (
            <div className="flex justify-between w-full">
              <Button 
                onClick={() => setActiveStep("upload")}
                variant="outline"
              >
                Back
              </Button>
              <Button 
                onClick={handleContinueGeneration}
                disabled={!editedScript || isGenerating}
                className="bg-gradient-primary hover:bg-gradient-primary-hover"
              >
                <span className="flex items-center gap-2">
                  <span>Continue with Voice</span>
                  <ArrowRightIcon className="h-4 w-4" />
                </span>
              </Button>
            </div>
          )}
          
          {activeStep === "generating" && jobStatus?.status === 'completed' && resultVideoUrl && (
            <div className="flex justify-end w-full">
              <Button 
                onClick={() => setActiveStep("result")}
                className="bg-gradient-primary hover:bg-gradient-primary-hover"
              >
                <span className="flex items-center gap-2">
                  <RefreshCwIcon className="h-4 w-4" />
                  <span>View Video Now</span>
                </span>
              </Button>
            </div>
          )}
        </CardFooter>
      </Card>
    </div>
  );
} 