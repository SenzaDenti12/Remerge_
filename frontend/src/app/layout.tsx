import type { Metadata } from "next";
import { Inter, Syne } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import Link from 'next/link';
import { AuthProvider } from '@/contexts/AuthContext';
import ClientLayout from '@/components/ClientLayout';

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-mode="dark" className="dark">
      <body
        className={`${inter.variable} ${syne.variable} antialiased min-h-screen flex flex-col`}
      >
        <AuthProvider>
          <ClientLayout>
        {children}
          </ClientLayout>
        </AuthProvider>
        <Toaster theme="dark" position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
