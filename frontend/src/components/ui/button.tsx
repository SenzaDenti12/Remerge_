import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-base md:text-lg font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/30 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors border-2 border-primary",
        destructive:
          "bg-destructive text-white shadow-sm hover:bg-destructive/90 focus-visible:ring-destructive/20 border-2 border-destructive/50",
        outline:
          "border-2 border-border bg-transparent shadow-sm hover:bg-accent hover:text-accent-foreground hover:border-primary/60 transition-colors",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80 transition-colors border-2 border-secondary/70",
        ghost:
          "hover:bg-accent hover:text-accent-foreground border-2 border-transparent hover:border-border/40 transition-colors",
        link: 
          "text-foreground underline-offset-4 hover:text-primary hover:underline transition-colors",
      },
      size: {
        default: "h-12 px-5 py-2 has-[>svg]:px-3 rounded-md",
        sm: "h-9 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5 text-sm",
        lg: "h-14 rounded-md px-8 has-[>svg]:px-4 text-lg md:text-xl",
        icon: "size-12 rounded-md",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
