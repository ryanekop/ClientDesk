import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    // Using a custom tailwind-merge configuration is not strictly required in v4 yet
    // but keeping it simple for now
    const customTwMerge = extendTailwindMerge({})
    return customTwMerge(clsx(inputs))
}

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    asChild?: boolean
    variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
    size?: "default" | "sm" | "lg" | "icon"
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = "default", size = "default", asChild = false, ...props }, ref) => {
        // Basic shadcn-like variants mapped for minimal usage
        const baseStyles = "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0"

        const variants: Record<string, string> = {
            default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
            destructive: "bg-red-500 text-white shadow-sm hover:bg-red-500/90",
            outline: "border border-border bg-background shadow-sm hover:bg-muted hover:text-foreground",
            secondary: "bg-muted text-muted-foreground shadow-sm hover:bg-muted/80",
            ghost: "hover:bg-muted hover:text-foreground",
            link: "text-primary underline-offset-4 hover:underline",
        }

        const sizes: Record<string, string> = {
            default: "h-9 px-4 py-2",
            sm: "h-8 rounded-md px-3 text-xs",
            lg: "h-10 rounded-md px-8",
            icon: "h-9 w-9",
        }

        const Comp = asChild ? Slot : "button"
        const variantStyle = variants[variant] || variants.default
        const sizeStyle = sizes[size] || sizes.default

        return (
            <Comp
                className={cn(baseStyles, variantStyle, sizeStyle, className)}
                ref={ref}
                {...props}
            />
        )
    }
)
Button.displayName = "Button"
