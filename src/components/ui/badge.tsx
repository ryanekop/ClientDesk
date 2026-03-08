import * as React from "react"
import { cn } from "@/lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning"
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
    const baseStyles = "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"

    const variants: Record<string, string> = {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary: "border-transparent bg-muted text-muted-foreground hover:bg-muted/80",
        destructive: "border-transparent bg-red-500 text-white hover:bg-red-500/80",
        outline: "text-foreground",
        success: "border-transparent bg-green-500/15 text-green-700 dark:bg-green-500/20 dark:text-green-400",
        warning: "border-transparent bg-yellow-500/15 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400",
    }

    return (
        <div className={cn(baseStyles, variants[variant], className)} {...props} />
    )
}
