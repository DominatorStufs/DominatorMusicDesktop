"use client"
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs"
import { clerkEnabled } from "./clerk-provider-wrapper"
import { LogIn } from "lucide-react"

export default function AuthButton() {
    if (!clerkEnabled) return null

    return (
        <>
            <SignedIn>
                <UserButton afterSignOutUrl="/" />
            </SignedIn>
            <SignedOut>
                <SignInButton mode="modal">
                    <button className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center transition hover:opacity-80" aria-label="Sign in">
                        <LogIn className="h-4 w-4" />
                    </button>
                </SignInButton>
            </SignedOut>
        </>
    )
}
