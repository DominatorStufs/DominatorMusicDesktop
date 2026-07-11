"use client"

// Clerk is completely optional. If NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is not
// set (or is an empty string), this wrapper simply renders its children as-is
// and the app works exactly the same — just without a Sign In button.
export const clerkEnabled =
    typeof process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY === "string" &&
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.trim().length > 0

let ClerkProviderComponent = null
if (clerkEnabled) {
    try {
        ClerkProviderComponent = require("@clerk/nextjs").ClerkProvider
    } catch (e) {
        // package not installed — treat as disabled
    }
}

export default function AppClerkProvider({ children }) {
    if (!clerkEnabled || !ClerkProviderComponent) return <>{children}</>
    return (
        <ClerkProviderComponent publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}>
            {children}
        </ClerkProviderComponent>
    )
}
