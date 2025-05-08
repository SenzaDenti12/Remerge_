// Remove server-side Supabase client and redirect logic
// import { createClient } from '@/lib/supabase/server'
// import { redirect } from 'next/navigation'

// Keep Button/Link imports if needed for layout, or move to client component
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import DashboardClientComponent from '@/components/dashboard-client-content'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

// Page can now be a simple component
export default function DashboardPage() {
  // Remove server-side auth check
  // const supabase = createClient()
  // const { data: { user } } = await supabase.auth.getUser()
  // if (!user) { redirect('/login') }

  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
       <div className="flex justify-between items-center mb-8">
         <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
           Your Dashboard
         </h1>
         {/* Maybe add a logout button or settings link here later */}
       </div>
      
       {/* Use Card for better structure - Client component handles content */}
       <Card className="w-full shadow-lg">
            <CardHeader>
                 <CardTitle>Overview</CardTitle>
                 <CardDescription>Manage your creations and credits.</CardDescription>
            </CardHeader>
            <CardContent>
                 <DashboardClientComponent /> 
            </CardContent>
       </Card>

       {/* Add more sections later? e.g., Usage stats? */}
    </div>
  )
} 