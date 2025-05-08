import type { Metadata } from "next";
import { Inter, Syne } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import AuthListener from "@/components/auth-listener";
import { createClient } from "@/lib/supabase/server";
import Link from 'next/link';

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "ReMerge - AI Video Transformation Studio",
  description: "Create viral-worthy videos for Instagram, TikTok, and YouTube Shorts with AI-powered lip sync and voice technology.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Check if user is authenticated
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  // Determine destinations for nav links based on auth status
  const dashboardLink = user ? "/dashboard" : "/login?return_to=/dashboard";
  const generateLink = user ? "/generate" : "/login?return_to=/generate"; 
  // Billing/pricing is always accessible without login
  const billingLink = "/billing";
  const getStartedLink = user ? "/generate" : "/login?return_to=/generate";
  
  return (
    <html lang="en" data-mode="dark" className="dark">
      <body
        className={`${inter.variable} ${syne.variable} antialiased min-h-screen flex flex-col`}
      >
        <AuthListener />
        <div className="fixed w-full h-full pointer-events-none -z-10">
          <div className="absolute top-0 left-0 w-1/3 h-1/3 bg-[#fb27ff]/10 rounded-full blur-[120px] -translate-x-1/2 -translate-y-1/2"></div>
          <div className="absolute bottom-0 right-0 w-1/3 h-1/2 bg-[#00ceff]/10 rounded-full blur-[120px] translate-x-1/3"></div>
          <div className="absolute top-1/2 left-1/2 w-1/2 h-1/2 bg-[#fb27ff]/5 rounded-full blur-[150px] -translate-x-1/2 -translate-y-1/2"></div>
        </div>
        <header className="backdrop-blur-sm bg-background/50 sticky top-0 z-50 border-b border-border/20 py-4">
          <div className="page-container flex-between">
            <a href="/" className="flex items-center">
              <div className="relative">
                <span className="text-3xl font-bold logo-text text-gradient">ReMerge</span>
                <div className="absolute -bottom-1 left-0 w-full h-[2px] bg-gradient-primary"></div>
              </div>
            </a>
            
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
              <Link 
                href={getStartedLink} 
                className="px-5 py-2 rounded-lg bg-gradient-primary hover:bg-gradient-primary-hover transition-all font-medium text-white shadow-md hover:shadow-lg"
              >
                Get Started
              </Link>
            </nav>
            
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
                <span className="text-2xl font-bold logo-text text-gradient">ReMerge</span>
                <p className="text-muted-foreground mt-3">
                  Transform your portraits into professional AI videos with natural speech and expressions.
                </p>
                <div className="mt-6 flex items-center gap-4">
                  <a href="#" className="text-foreground/70 hover:text-primary transition">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/>
                    </svg>
                  </a>
                  <a href="#" className="text-foreground/70 hover:text-primary transition">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0c-6.628 0-12 5.373-12 12s5.372 12 12 12 12-5.373 12-12-5.372-12-12-12zm9.885 11.441c-2.575-.422-4.943-.445-7.103-.073-.244-.563-.497-1.125-.767-1.68 2.31-1 4.165-2.358 5.548-4.082 1.35 1.594 2.197 3.619 2.322 5.835zm-3.842-7.282c-1.205 1.554-2.868 2.783-4.986 3.68-1.016-1.861-2.178-3.676-3.488-5.438.779-.197 1.591-.314 2.431-.314 2.275 0 4.368.779 6.043 2.072zm-10.516-.993c1.331 1.742 2.511 3.538 3.537 5.381-2.43.715-5.331 1.082-8.684 1.105.692-2.835 2.601-5.193 5.147-6.486zm-5.44 8.834l.013-.256c3.849-.005 7.169-.448 9.95-1.322.233.475.456.95.67 1.424-4.38 1.328-7.709 4.371-9.004 8.473-1.003-1.626-1.588-3.537-1.629-5.587zm1.964 6.945c1.209-3.508 3.939-6.136 7.683-7.508 1.074 2.783 1.896 5.659 2.425 8.598-.561.187-1.152.322-1.759.392-2.687.307-5.289-.618-7.066-2.065zm9.857 2.285c-.542-2.807-1.323-5.564-2.343-8.243 1.977-.35 4.047-.329 6.246.022-.202 3.349-1.772 6.324-3.902 8.108z"/>
                    </svg>
                  </a>
                  <a href="#" className="text-foreground/70 hover:text-primary transition">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm-2.917 16.083c-2.258 0-4.083-1.825-4.083-4.083s1.825-4.083 4.083-4.083c1.103 0 2.024.402 2.735 1.067l-1.107 1.068c-.304-.292-.834-.63-1.628-.63-1.394 0-2.531 1.155-2.531 2.579 0 1.424 1.138 2.579 2.531 2.579 1.616 0 2.224-1.162 2.316-1.762h-2.316v-1.4h3.855c.036.204.064.408.064.677.001 2.332-1.563 3.988-3.919 3.988zm9.917-3.5h-1.75v1.75h-1.167v-1.75h-1.75v-1.166h1.75v-1.75h1.167v1.75h1.75v1.166z"/>
                    </svg>
                  </a>
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-8 lg:gap-16">
                <div>
                  <h4 className="font-semibold mb-4 text-lg">Platform</h4>
                  <ul className="space-y-3 text-muted-foreground">
                    <li><Link href={dashboardLink} className="hover:text-primary transition-colors">Dashboard</Link></li>
                    <li><Link href={generateLink} className="hover:text-primary transition-colors">Create Video</Link></li>
                    <li><Link href="/demo" className="hover:text-primary transition-colors">Demo</Link></li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-4 text-lg">Resources</h4>
                  <ul className="space-y-3 text-muted-foreground">
                    <li><a href="#" className="hover:text-primary transition-colors">Help Center</a></li>
                    <li><a href="#" className="hover:text-primary transition-colors">Tutorials</a></li>
                    <li><a href="#" className="hover:text-primary transition-colors">Documentation</a></li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-4 text-lg">Legal</h4>
                  <ul className="space-y-3 text-muted-foreground">
                    <li><a href="#" className="hover:text-primary transition-colors">Privacy Policy</a></li>
                    <li><a href="#" className="hover:text-primary transition-colors">Terms of Service</a></li>
                    <li><a href="#" className="hover:text-primary transition-colors">Cookie Policy</a></li>
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
        <Toaster theme="dark" position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
