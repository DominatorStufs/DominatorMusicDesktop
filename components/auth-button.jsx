"use client"
import { clerkEnabled } from "./clerk-provider-wrapper"
import { LogIn, User } from "lucide-react"
import { useEffect, useState } from "react"
import { Skeleton } from "./ui/skeleton"

export default function AuthButton() {
    const [Components, setComponents] = useState(null)
    // Distinguishes "still importing Clerk" from "Clerk is off". Without this
    // the button simply popped into existence after hydration.
    const [loading, setLoading] = useState(clerkEnabled)

    useEffect(() => {
        if (!clerkEnabled) return
        let cancelled = false
        // Dynamically import Clerk components only when enabled
        import("@clerk/nextjs")
            .then((m) => {
                if (cancelled) return
                setComponents({
                    SignedIn: m.SignedIn,
                    SignedOut: m.SignedOut,
                    SignInButton: m.SignInButton,
                    UserButton: m.UserButton,
                })
                setLoading(false)
            })
            .catch(() => {
                // Clerk package not properly installed, silently skip
                if (!cancelled) setLoading(false)
            })
        return () => {
            cancelled = true
        }
    }, [])

    if (!clerkEnabled) return null

    // Reserve the space so the header does not shift when Clerk finishes loading.
    if (loading || !Components) {
        return <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />
    }

    const { SignedIn, SignedOut, SignInButton, UserButton } = Components

    return (
        <>
            <SignedIn>
                <div className="h-9 w-9 flex items-center justify-center">
                    <UserButton
                        afterSignOutUrl="/"
                        appearance={{
                            elements: {
                                avatarBox: "h-9 w-9",
                            },
                        }}
                    />
                </div>
            </SignedIn>
            <SignedOut>
                <SignInButton mode="modal">
                    <button
                        className="group h-9 rounded-full bg-secondary flex items-center justify-center gap-1.5 px-3 text-sm font-medium transition hover:bg-secondary/70 active:scale-95"
                        aria-label="Sign in"
                    >
                        <LogIn className="h-4 w-4" />
                        <span className="hidden lg:inline">Sign in</span>
                    </button>
                </SignInButton>
            </SignedOut>
        </>
    )
}
