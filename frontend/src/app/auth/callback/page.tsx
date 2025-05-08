'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [status, setStatus] = useState<'processing' | 'error'>('processing');

  useEffect(() => {
    const handleAuthCallback = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Already have a session (e.g. from hash auto-parsed)
        const returnToImmediate = searchParams.get('return_to') || '/dashboard';
        router.replace(returnToImmediate);
        return;
      }

      // Fallback: wait for the SIGNED_IN event which will fire after Supabase
      // processes the magic-link hash in the URL.
      const { data: listener } = supabase.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_IN') {
          const dest = searchParams.get('return_to') || '/dashboard';
          listener.subscription.unsubscribe();
          router.replace(dest);
        }
      });
    };

    handleAuthCallback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center text-center p-8">
      {status === 'processing' ? (
        <div>
          <h1 className="text-2xl font-bold mb-4">Finalizing Sign-In…</h1>
          <p className="text-muted-foreground">Just a sec while we log you in.</p>
          <div className="mt-8 flex justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        </div>
      ) : (
        <p className="text-destructive">Authentication failed. Redirecting…</p>
      )}
    </div>
  );
} 