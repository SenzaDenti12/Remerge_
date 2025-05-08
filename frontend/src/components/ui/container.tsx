import { cn } from "@/lib/utils"

interface ContainerProps {
  className?: string
  children: React.ReactNode
}

export function Container({ className, children }: ContainerProps) {
  return (
    <div className={cn("max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8", className)}>
      {children}
    </div>
  )
} 