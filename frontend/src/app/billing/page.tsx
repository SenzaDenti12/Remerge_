'use client' // This page needs client-side interaction

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { toast } from 'sonner'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle } from 'lucide-react'

export default function BillingPage() {
    const [loading, setLoading] = useState(true);
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [stripeCustomerId, setStripeCustomerId] = useState<string | null>(null);
    const [isLoadingCheckout, setIsLoadingCheckout] = useState(false);
    const [isLoadingPortal, setIsLoadingPortal] = useState(false);
    const supabase = createClient();
    const router = useRouter();
    const searchParams = useSearchParams();
    const returnPath = searchParams.get('return_to');

    // State to store fetched plan details
    const [planName, setPlanName] = useState<string | null>(null);

    useEffect(() => {
        const checkAuth = async () => {
             setLoading(true);
             const { data: { session }, error: sessionError } = await supabase.auth.getSession();
             
             // Update authentication state but don't redirect
             setIsAuthenticated(!!session && !sessionError);
             
             if (session && !sessionError) {
                 const token = session.access_token;

                 // Fetch subscription status from our backend only if authenticated
                 try {
                     const statusResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/subscription-status`, {
                         headers: {
                             'Authorization': `Bearer ${token}`
                         }
                     });
                     if (!statusResponse.ok) {
                         const errorData = await statusResponse.json().catch(() => ({}));
                         throw new Error(errorData.detail || "Failed to fetch subscription status");
                     }
                     const statusData = await statusResponse.json();
                     
                     console.log("Subscription Status Data:", statusData);
                     setIsSubscribed(statusData.isActive || false);
                     setStripeCustomerId(statusData.stripeCustomerId || null);
                     setPlanName(statusData.planName || null);

                 } catch (error) {
                     console.error("Failed to fetch subscription status:", error);
                     // Only show toast error if authenticated
                     toast.error(`Error loading billing info: ${(error as Error).message}`);
                     setIsSubscribed(false);
                     setStripeCustomerId(null);
                     setPlanName(null);
                 }
             } else {
                 // Not authenticated - show pricing only
                 setIsSubscribed(false);
                 setStripeCustomerId(null);
                 setPlanName(null);
             }

             setLoading(false);
        };
        
        checkAuth();
    }, [supabase]);

    const handleCheckout = async (priceId: string) => {
        // Check if the user is authenticated
        const { data: { session } } = await supabase.auth.getSession();
        
        // If not authenticated, redirect to login with return path
        if (!session) {
            const returnUrl = `/login?return_to=/billing/checkout/${priceId}`;
            router.push(returnUrl);
            return;
        }
        
        // Continue checkout process if authenticated
        setIsLoadingCheckout(true);
        try {
            const token = session.access_token;

            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/create-checkout-session`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ price_id: priceId })
            });

            const checkoutData = await response.json();
            if (!response.ok) {
                throw new Error(checkoutData.detail || "Failed to create checkout session");
            }
            if (checkoutData.url) {
                window.location.href = checkoutData.url;
            } else {
                 throw new Error("Missing checkout URL from response");
            }
        } catch (error) {
            console.error("Checkout error:", error);
            toast.error(`Checkout Error: ${(error as Error).message}`);
            setIsLoadingCheckout(false);
        }
    };

    const handleManageSubscription = async () => {
        if (!stripeCustomerId) {
            toast.error("Stripe customer ID not found.");
            return;
        }
        setIsLoadingPortal(true);
         try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("User not logged in");
            const token = session.access_token;

            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/create-portal-session`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ customer_id: stripeCustomerId })
            });

            const portalData = await response.json();
            if (!response.ok) {
                throw new Error(portalData.detail || "Failed to create customer portal session");
            }
            if (portalData.url) {
                window.location.href = portalData.url;
            } else {
                 throw new Error("Missing portal URL from response");
            }
        } catch (error) {
            console.error("Portal error:", error);
            toast.error(`Portal Error: ${(error as Error).message}`);
            setIsLoadingPortal(false);
        }
    };

    // Check if there's a price ID in the URL path for direct checkout after login
    useEffect(() => {
        const checkForCheckoutRedirect = async () => {
            // Check if we're returning from login with checkout intent
            if (returnPath && returnPath.startsWith('/billing/checkout/') && isAuthenticated) {
                const pathParts = returnPath.split('/');
                const priceId = pathParts[pathParts.length - 1];
                
                if (priceId && priceId.startsWith('price_')) {
                    // Automatically trigger checkout for the stored price ID
                    handleCheckout(priceId);
                }
            }
        };
        
        if (isAuthenticated && !loading) {
            checkForCheckoutRedirect();
        }
    }, [isAuthenticated, loading, returnPath]);

    // Use environment variables for Price IDs, with fallbacks
    const creatorPriceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_CREATOR || 'YOUR_CREATOR_PRICE_ID';
    const proPriceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_PRO || 'YOUR_PRO_PRICE_ID';
    const growthPriceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_GROWTH || 'YOUR_GROWTH_PRICE_ID';

    // Basic check for valid customer ID (not the placeholder)
    const hasValidCustomerId = stripeCustomerId && stripeCustomerId !== 'cus_TESTFROMCLI';

    if (loading) {
        // Improved Loading State
        return (
            <div className="content-container py-12 md:py-24 text-center">
                 <h1 className="text-3xl md:text-4xl font-bold mb-8">Billing & Subscription</h1>
                 <p className="text-xl text-muted-foreground">Loading your billing details...</p>
             </div>
        )
    }

    return (
        <div className="content-container py-12 md:py-24">
          {/* Back link */}
          <div className="absolute top-6 left-6">
            <Link href={isAuthenticated ? "/dashboard" : "/"}>
              <Button variant="outline">
                {isAuthenticated ? "Back to Dashboard" : "Back to Home"}
              </Button>
            </Link>
          </div>
      
          {/* Page heading */}
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Billing &amp; Subscription
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              {isAuthenticated 
                ? "Manage your subscription plan, view billing history, and update payment details."
                : "Choose a plan that fits your needs."}
            </p>
          </div>
      
          {isAuthenticated && isSubscribed ? (
            /* ---------- Current Subscription View ---------- */
            <Card className="w-full max-w-2xl mx-auto">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl md:text-3xl">
                  Your Current Plan
                </CardTitle>
                <CardDescription className="text-lg">
                  You are currently subscribed to the{" "}
                  <span className="font-medium text-primary">
                    {planName || "Unknown"}
                  </span>{" "}
                  plan.
                </CardDescription>
              </CardHeader>
      
              <CardContent className="text-center">
                <p className="text-muted-foreground mb-6">
                  Access the Stripe customer portal to manage your subscription
                  details, view past invoices, or update your payment method.
                </p>
              </CardContent>
      
              <CardFooter className="flex justify-center">
                <Button
                  onClick={handleManageSubscription}
                  disabled={isLoadingPortal || !hasValidCustomerId}
                  size="lg"
                >
                  {isLoadingPortal ? "Loading Portal..." : "Manage Subscription"}
                </Button>
              </CardFooter>
      
              {!hasValidCustomerId && (
                <p className="text-center text-sm text-destructive mt-4 pb-4">
                  Customer ID not found or invalid. Please contact support if you
                  believe this is an error.
                </p>
              )}
            </Card>
          ) : (
            /* ---------- Plan Selection View ---------- */
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
                {/* Creator Plan Card */}
                <Card className="flex flex-col">
                  <CardHeader>
                    <CardTitle className="text-2xl md:text-3xl">
                      Creator
                    </CardTitle>
                    <CardDescription className="text-lg">
                      For hobbyists and social media posts
                    </CardDescription>
                  </CardHeader>
      
                  <CardContent className="flex-grow space-y-6">
                    <p className="text-4xl font-bold">
                      $29
                      <span className="text-lg font-normal text-muted-foreground">
                        /month
                      </span>
                    </p>
                    <ul className="space-y-3 text-left">
                      <li className="flex items-center gap-3">
                        <CheckCircle className="size-5 text-primary" /> 10 videos (~10 min)
                      </li>
                      <li className="flex items-center gap-3">
                        <CheckCircle className="size-5 text-primary" /> Standard voice options
                      </li>
                      <li className="flex items-center gap-3">
                        <CheckCircle className="size-5 text-primary" /> Basic support
                      </li>
                      <li className="flex items-center gap-3">
                        <CheckCircle className="size-5 text-primary" /> ~48% savings vs. pay-as-you-go
                      </li>
                    </ul>
                  </CardContent>
      
                  <CardFooter>
                    <Button
                      onClick={() => handleCheckout(creatorPriceId)}
                      disabled={isLoadingCheckout || !creatorPriceId.startsWith("price_")}
                      className="w-full mb-4"
                      size="lg"
                    >
                      {isLoadingCheckout ? "Redirecting..." : (isAuthenticated ? "Subscribe to Creator" : "Sign Up & Subscribe")}
                    </Button>
                  </CardFooter>
                </Card>
      
                {/* Pro Plan Card */}
                <Card className="flex flex-col border-primary/50 relative scale-105">
                  {/* Badge */}
                  <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-lg">
                    Most Popular
                  </div>
      
                  <CardHeader>
                    <CardTitle className="text-2xl md:text-3xl">Pro</CardTitle>
                    <CardDescription className="text-lg">
                      For social agencies and coaches
                    </CardDescription>
                  </CardHeader>
      
                  <CardContent className="flex-grow space-y-6">
                    <p className="text-4xl font-bold">
                      $79
                      <span className="text-lg font-normal text-muted-foreground">
                        /month
                      </span>
                    </p>
                    <ul className="space-y-3 text-left">
                      <li className="flex items-center gap-3">
                        <CheckCircle className="size-5 text-primary" /> 30 videos
                      </li>
                      <li className="flex items-center gap-3">
                        <CheckCircle className="size-5 text-primary" /> Premium voice options
                      </li>
                      <li className="flex items-center gap-3">
                        <CheckCircle className="size-5 text-primary" /> Priority
                        support
                      </li>
                      <li className="flex items-center gap-3">
                        <CheckCircle className="size-5 text-primary" /> ~53% savings vs. pay-as-you-go
                      </li>
                    </ul>
                  </CardContent>
      
                  <CardFooter>
                    <Button
                      onClick={() => handleCheckout(proPriceId)}
                      disabled={isLoadingCheckout || !proPriceId.startsWith("price_")}
                      className="w-full mb-4"
                      size="lg"
                      variant="default"
                    >
                      {isLoadingCheckout ? "Redirecting..." : (isAuthenticated ? "Subscribe to Pro" : "Sign Up & Subscribe")}
                    </Button>
                  </CardFooter>
                </Card>

                {/* Growth Plan Card */}
                <Card className="flex flex-col">
                  <CardHeader>
                    <CardTitle className="text-2xl md:text-3xl">
                      Growth
                    </CardTitle>
                    <CardDescription className="text-lg">
                      For brands & startups with daily content
                    </CardDescription>
                  </CardHeader>
      
                  <CardContent className="flex-grow space-y-6">
                    <p className="text-4xl font-bold">
                      $199
                      <span className="text-lg font-normal text-muted-foreground">
                        /month
                      </span>
                    </p>
                    <ul className="space-y-3 text-left">
                      <li className="flex items-center gap-3">
                        <CheckCircle className="size-5 text-primary" /> 90 videos
                      </li>
                      <li className="flex items-center gap-3">
                        <CheckCircle className="size-5 text-primary" /> All voice options
                      </li>
                      <li className="flex items-center gap-3">
                        <CheckCircle className="size-5 text-primary" /> Dedicated
                        support
                      </li>
                      <li className="flex items-center gap-3">
                        <CheckCircle className="size-5 text-primary" /> ~57% savings vs. pay-as-you-go
                      </li>
                    </ul>
                  </CardContent>
      
                  <CardFooter>
                    <Button
                      onClick={() => handleCheckout(growthPriceId)}
                      disabled={isLoadingCheckout || !growthPriceId.startsWith("price_")}
                      className="w-full mb-4"
                      size="lg"
                    >
                      {isLoadingCheckout ? "Redirecting..." : (isAuthenticated ? "Subscribe to Growth" : "Sign Up & Subscribe")}
                    </Button>
                  </CardFooter>
                </Card>
              </div>
      
              <div className="text-center max-w-3xl mx-auto mt-12">
                <p className="text-muted-foreground">
                  All plans are billed monthly. 1 video = approximately 1 minute of content.
                </p>
                {!isAuthenticated && (
                  <p className="text-muted-foreground mt-6">
                    <Link href="/login" className="text-primary underline underline-offset-4">
                      Sign in
                    </Link> to your account first if you already have one, or create an account during checkout.
                  </p>
                )}
                <p className="text-muted-foreground mt-4">
                  Not ready to commit? <Link href="/demo" className="text-primary underline underline-offset-4">Try our demo</Link> or 
                  start with <Link href="/login?return_to=/generate" className="text-primary underline underline-offset-4">one free video</Link>.
                </p>
              </div>
            </>
          )}
        </div>
      );
}