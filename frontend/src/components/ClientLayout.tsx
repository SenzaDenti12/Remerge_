'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation'; // Import useRouter
import { useAuth } from '@/contexts/AuthContext';
import { ReactNode, useEffect } from 'react';
import { Button } from '@/components/ui/button'; // Assuming you have a Button component

export default function ClientLayout({ children }: { children: ReactNode }) {
  const { user, session, isLoading, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter(); // Initialize router

  // Determine destinations for nav links based on auth status
  const dashboardLink = user ? "/dashboard" : "/login?return_to=/dashboard";
  const generateLink = user ? "/generate" : "/login?return_to=/generate"; 
  const billingLink = "/billing"; // Billing/pricing is always accessible
  
  // Handle logout
  const handleLogout = async () => {
    await signOut();
    // Redirect to home or login page after logout
    router.push('/'); 
  };

  // Redirect logged-in users from auth pages
  useEffect(() => {
    if (!isLoading && user) {
      if (pathname === '/login' || pathname === '/signup' || pathname === '/auth/callback') {
        router.replace('/dashboard');
      }
    }
  }, [user, isLoading, pathname, router]);

  // Show a loading state or a minimal layout while auth is loading
  // to prevent flash of unauthenticated content or incorrect redirects.
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <p>Loading...</p> {/* Replace with a proper spinner/loader component */}
      </div>
    );
  }

  return (
    <>
      <div className="fixed w-full h-full pointer-events-none -z-10">
        <div className="absolute top-0 left-0 w-1/3 h-1/3 bg-[#fb27ff]/10 rounded-full blur-[120px] -translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 right-0 w-1/3 h-1/2 bg-[#00ceff]/10 rounded-full blur-[120px] translate-x-1/3"></div>
        <div className="absolute top-1/2 left-1/2 w-1/2 h-1/2 bg-[#fb27ff]/5 rounded-full blur-[150px] -translate-x-1/2 -translate-y-1/2"></div>
      </div>
      <header className="backdrop-blur-sm bg-background/50 sticky top-0 z-50 border-b border-border/20 py-4">
        <div className="page-container flex-between">
          <Link href="/" className="flex items-center">
            <div className="relative">
              <span className="text-3xl font-bold logo-text text-gradient">ReMerge</span>
              <div className="absolute -bottom-1 left-0 w-full h-[2px] bg-gradient-primary"></div>
            </div>
          </Link>
          
          <nav className="hidden md:flex items-center space-x-8">
            <Link href={dashboardLink} className="text-foreground/80 hover:text-foreground transition font-medium">
              Dashboard
            </Link>
            <Link href={generateLink} className="text-foreground/80 hover:text-foreground transition font-medium">
              Create Video
            </Link>
            <Link href={billingLink} className="text-foreground/80 hover:text-foreground transition font-medium">
              Pricing
            </Link>
            
            {user ? (
              <>
                {/* Optional: Link to an account page */}
                {/* <Link href="/account" className="text-foreground/80 hover:text-foreground transition font-medium">Account</Link> */}
                <Button 
                  onClick={handleLogout} 
                  variant="outline" 
                  className="px-5 py-2 rounded-lg font-medium shadow-md hover:shadow-lg"
                >
                  Logout
                </Button>
              </>
            ) : (
              <Link 
                href="/login?return_to=/generate"
                className="px-5 py-2 rounded-lg bg-gradient-primary hover:bg-gradient-primary-hover transition-all font-medium text-white shadow-md hover:shadow-lg"
              >
                Get Started
              </Link>
            )}
          </nav>
          
          {/* Mobile Menu Button - Functionality to be implemented if needed */}
          <button className="md:hidden text-foreground">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" x2="20" y1="12" y2="12"></line>
              <line x1="4" x2="20" y1="6" y2="6"></line>
              <line x1="4" x2="20" y1="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </header>
      <main className="flex-grow page-container py-8 md:py-12">
        {children}
      </main>
      <footer className="py-12 mt-auto bg-card/30">
        <div className="page-container">
          <div className="flex flex-col md:flex-row justify-between items-start gap-10">
            <div className="max-w-xs">
              <Link href="/" className="text-2xl font-bold logo-text text-gradient">ReMerge</Link>
              <p className="text-muted-foreground mt-3">
                Transform your portraits into professional AI videos with natural speech and expressions.
              </p>
              {/* Social media links removed for brevity, can be added back */}
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-8 lg:gap-16">
              <div>
                <h4 className="font-semibold mb-4 text-lg">Platform</h4>
                <ul className="space-y-3 text-muted-foreground">
                  <li><Link href={dashboardLink} className="hover:text-primary transition-colors">Dashboard</Link></li>
                  <li><Link href={generateLink} className="hover:text-primary transition-colors">Create Video</Link></li>
                  <li><Link href={user ? "/demo" : "/login?return_to=/demo"} className="hover:text-primary transition-colors">Demo</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-4 text-lg">Resources</h4>
                <ul className="space-y-3 text-muted-foreground">
                  {/* Placeholder links */}
                  <li><a href="#" className="hover:text-primary transition-colors">Help Center</a></li>
                  <li><a href="#" className="hover:text-primary transition-colors">Tutorials</a></li>
                  <li><a href="#" className="hover:text-primary transition-colors">Documentation</a></li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-4 text-lg">Legal</h4>
                <ul className="space-y-3 text-muted-foreground">
                  <li><Link href="/privacy-policy" className="hover:text-primary transition-colors">Privacy Policy</Link></li>
                  <li><Link href="/terms-of-service" className="hover:text-primary transition-colors">Terms of Service</Link></li>
                  {/* Optional: Add Cookie Policy link if you create one */}
                  {/* <li><Link href="/cookie-policy" className="hover:text-primary transition-colors">Cookie Policy</Link></li> */}
                </ul>
              </div>
            </div>
          </div>
          
          <div className="border-t border-border/20 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} ReMerge. All rights reserved.</p>
            <div className="mt-4 md:mt-0">
              <span className="text-sm text-muted-foreground">Made with ❤️ for creative storytellers</span>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
} 