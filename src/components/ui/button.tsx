import * as React from "react"

import { cn } from "@/lib/utils"
import { Slot } from "@radix-ui/react-slot"

const buttonVariants = ({
  variant = "default",
  size = "default",
  className,
}) => {
  const base = "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"

  const variants = {
    default: "bg-primary text-primary-foreground hover:bg-primary/90",
    destructive:
      "bg-destructive text-destructive-foreground hover:bg-destructive/90",
    outline:
      "border border-input bg-card hover:bg-muted",
    secondary:
      "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    ghost: "hover:bg-muted",
    link: "text-foreground underline-offset-4 hover:underline",
  }

  const sizes = {
    default: "h-8 px-3 py-1",
    sm: "h-8 rounded-md px-3 text-xs",
    lg: "h-10 rounded-md px-4 py-2",
    icon: "h-8 w-8 p-0",
  }

  return cn(
    base,
    variants[variant],
    sizes[size],
    className
  )
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
  size?: "default" | "sm" | "lg" | "icon"
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }