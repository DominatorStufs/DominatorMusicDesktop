"use client"
import { clerkEnabled } from "./clerk-provider-wrapper"
import { LogIn } from "lucide-react"
import { useEffect, useState } from "react"

export default function AuthButton() {
    const [Components, setComponents] = useState(null)

    useEffect(() => {
        if (!clerkEnabled) return
        // Dynamically import Clerk components only when enabled
        import("@clerk/nextjs").then((m) => {
            setComponents({
                SignedIn: m.SignedIn,
                SignedOut: m.SignedOut,
                SignInButton: m.SignInButton,
                UserButton: m.UserButton,
            })
        }).catch(() => {
            // Clerk package not properly installed, silently skip
        })
    }, [])

    if (!clerkEnabled || !Components) return null

    const { SignedIn, SignedOut, SignInButton, UserButton } = Components

    return (
        <>
            <SignedIn>
                <UserButton afterSignOutUrl="/" />
            </SignedIn>
            <SignedOut>
                <SignInButton mode="modal">
                    <button
                        className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center transition hover:opacity-80"
                        aria-label="Sign in"
                    >
                        <LogIn className="h-4 w-4" />
                    </button>
                </SignInButton>
            </SignedOut>
        </>
    )
}
