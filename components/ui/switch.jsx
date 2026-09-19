"use client"
import { cn } from "@/lib/utils"

export function Switch({ checked, onCheckedChange, className, ...props }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            onClick={() => onCheckedChange?.(!checked)}
            className={cn(
                "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                checked ? "bg-primary" : "bg-input",
                className
            )}
            {...props}
        >
            <span
                className={cn(
                    "pointer-events-none inline-block h-5 w-5 translate-x-0.5 transform rounded-full bg-background shadow-lg ring-0 transition-transform duration-300 ease-out",
                    checked && "translate-x-5"
                )}
            />
        </button>
    )
}
