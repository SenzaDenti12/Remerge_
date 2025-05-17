import AuthForm from '@/components/auth-form'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default function LoginPage() {
  return (
    <div className="flex items-center justify-center min-h-screen px-4">
       <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Welcome!</CardTitle>
          <CardDescription>Sign in or create an account using your email and password.</CardDescription>
        </CardHeader>
        <CardContent>
           <AuthForm />
         </CardContent>
       </Card>
    </div>
  )
} 