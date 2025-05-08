'use client' // This page needs client-side interaction

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle } from 'lucide-react'

export default function BillingPage() {
    const [loading, setLoading] = useState(true);
    const [isSubscribed, setIsSubscribed] = useState(false); // Placeholder state
    const [stripeCustomerId, setStripeCustomerId] = useState<string | null>(null); // Placeholder state
    const [isLoadingCheckout, setIsLoadingCheckout] = useState(false);
    const [isLoadingPortal, setIsLoadingPortal] = useState(false);
    const supabase = createClient();
    const router = useRouter();

    // State to store fetched plan details
    const [planName, setPlanName] = useState<string | null>(null);

    useEffect(() => {
        const checkSubscription = async () => {
             setLoading(true);
             const { data: { session }, error: sessionError } = await supabase.auth.getSession();
             if (sessionError || !session) {
                 toast.error("Please log in to manage billing.");
                 // Redirect if no session on client-side either
                 router.push('/login'); 
                 setLoading(false); 
                 return;
             }
             const token = session.access_token;

             // Fetch subscription status from our backend
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
                 
                 console.log("Subscription Status Data:", statusData); // Log fetched data
                 setIsSubscribed(statusData.isActive || false);
                 setStripeCustomerId(statusData.stripeCustomerId || null);
                 // TODO: Store/display planName (statusData.planName) if needed
                 setPlanName(statusData.planName || null);

             } catch (error) {
                 console.error("Failed to fetch subscription status:", error);
                 toast.error(`Error loading billing info: ${(error as Error).message}`);
                 // Keep defaults (not subscribed)
                 setIsSubscribed(false);
                 setStripeCustomerId(null);
                 setPlanName(null); // Reset plan name on error
             }

             setLoading(false);
        };
        checkSubscription();
    }, [supabase, router]);

    const handleCheckout = async (priceId: string) => {
        setIsLoadingCheckout(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("User not logged in");
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

    // Use environment variables for Price IDs, with fallbacks
    const creatorPriceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_CREATOR || 'YOUR_CREATOR_PRICE_ID';
    const proPriceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_PRO || 'YOUR_PRO_PRICE_ID';
    const growthPriceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_GROWTH || 'YOUR_GROWTH_PRICE_ID';

    // Basic check for valid customer ID (not the placeholder)
    const hasValidCustomerId = stripeCustomerId && stripeCustomerId !== 'cus_TESTFROMCLI';

    // --- DEBUG LOGGING --- 
    console.log("[BillingPage Debug]");
    console.log("Loading:", loading);
    console.log("Is Subscribed:", isSubscribed);
    console.log("Is Loading Checkout:", isLoadingCheckout);
    console.log("Creator Price ID:", creatorPriceId, "Valid:", creatorPriceId.startsWith('price_'));
    console.log("Pro Price ID:", proPriceId, "Valid:", proPriceId.startsWith('price_'));
    console.log("Growth Price ID:", growthPriceId, "Valid:", growthPriceId.startsWith('price_'));
    // --- END DEBUG LOGGING ---

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
            <Link href="/dashboard">
              <Button variant="outline">Back to Dashboard</Button>
            </Link>
          </div>
      
          {/* Page heading */}
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Billing &amp; Subscription
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Manage your subscription plan, view billing history, and update payment
              details.
            </p>
          </div>
      
          {isSubscribed ? (
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
                      {isLoadingCheckout ? "Redirecting..." : "Subscribe to Creator"}
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
                      {isLoadingCheckout ? "Redirecting..." : "Subscribe to Pro"}
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
                      {isLoadingCheckout ? "Redirecting..." : "Subscribe to Growth"}
                    </Button>
                  </CardFooter>
                </Card>
              </div>
      
              <p className="text-center text-muted-foreground mt-12">
                All plans are billed monthly. 1 video = approximately 1 minute of content.
              </p>
            </>
          )}
        </div>
      );
}