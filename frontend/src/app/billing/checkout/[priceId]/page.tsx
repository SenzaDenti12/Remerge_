'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

// This is a handler page that redirects users from login to checkout
export default function CheckoutRedirectHandler({ params }: { params: { priceId: string } }) {
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();
  const { priceId } = params;

  useEffect(() => {
    const handleRedirect = async () => {
      try {
        setIsLoading(true);
        
        // Verify the user is authenticated
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          // Not authenticated, redirect to login with return path
          router.push(`/login?return_to=/billing/checkout/${priceId}`);
          return;
        }
        
        // User is authenticated, proceed with checkout
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
          // Redirect to Stripe checkout
          window.location.href = checkoutData.url;
        } else {
          throw new Error("Missing checkout URL from response");
        }
      } catch (error) {
        console.error("Checkout redirect error:", error);
        toast.error(`Checkout Error: ${(error as Error).message}`);
        // Redirect to billing page on error
        router.push('/billing');
      } finally {
        setIsLoading(false);
      }
    };

    if (priceId) {
      handleRedirect();
    } else {
      // Invalid price ID, redirect to billing page
      router.push('/billing');
    }
  }, [priceId, router, supabase]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Preparing Your Checkout...</h1>
        <p className="text-muted-foreground">
          Just a moment while we set up your payment session.
        </p>
        <div className="mt-8 flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </div>
    </div>
  );
} 