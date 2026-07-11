"use client"
import { ClerkProvider } from "@clerk/nextjs"

export const clerkEnabled = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

export default function AppClerkProvider({ children }) {
    if (!clerkEnabled) return children
    return (
        <ClerkProvider publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}>
            {children}
        </ClerkProvider>
    )
}
