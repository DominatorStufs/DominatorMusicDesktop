"use client"
import { useEffect, useState } from "react"
import {
    Credenza,
    CredenzaContent,
    CredenzaHeader,
    CredenzaTitle,
    CredenzaDescription,
    CredenzaBody,
    CredenzaFooter,
} from "@/components/ui/credenza"
import { Button } from "@/components/ui/button"
import { Search, Heart, Sparkles, Share2, Music } from "lucide-react"

const SLIDES = [
    {
        icon: Music,
        title: "Welcome to DominatorMusic",
        description: "Stream and download any song, free, with no account needed.",
    },
    {
        icon: Search,
        title: "Find anything",
        description: "Search songs, artists or albums, or just browse by genre and mood on the home page.",
    },
    {
        icon: Heart,
        title: "Like songs & build playlists",
        description: "Tap the heart on any song to save it, and create playlists from your Library page.",
    },
    {
        icon: Sparkles,
        title: "Make it yours",
        description: "Tap the sparkle button top-right to switch UI styles, pick an accent color, or turn on the glass effect.",
    },
    {
        icon: Share2,
        title: "Share what you're playing",
        description: "Generate a Now Playing story card straight from the player and share it to WhatsApp or Instagram.",
    },
]

export default function OnboardingTour() {
    const [open, setOpen] = useState(false)
    const [step, setStep] = useState(0)

    useEffect(() => {
        let seen = true
        try { seen = localStorage.getItem("onboarding-seen") === "true" } catch (e) { }
        if (!seen) {
            const t = setTimeout(() => setOpen(true), 600)
            return () => clearTimeout(t)
        }
    }, [])

    const finish = () => {
        try { localStorage.setItem("onboarding-seen", "true") } catch (e) { }
        setOpen(false)
    }

    const handleOpenChange = (isOpen) => {
        if (!isOpen) finish()
        else setOpen(true)
    }

    const slide = SLIDES[step]
    const Icon = slide.icon
    const isLast = step === SLIDES.length - 1

    return (
        <Credenza open={open} onOpenChange={handleOpenChange}>
            <CredenzaContent className="glass-surface">
                <CredenzaHeader>
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                        <Icon className="h-5 w-5" />
                    </div>
                    <CredenzaTitle>{slide.title}</CredenzaTitle>
                    <CredenzaDescription>{slide.description}</CredenzaDescription>
                </CredenzaHeader>
                <CredenzaBody className="pb-6">
                    <div className="flex items-center justify-center gap-1.5">
                        {SLIDES.map((_, i) => (
                            <div key={i} className={`h-1.5 rounded-full transition-all ${i === step ? "w-6 bg-primary" : "w-1.5 bg-secondary"}`} />
                        ))}
                    </div>
                </CredenzaBody>
                <CredenzaFooter className="flex-row justify-between items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={finish}>Skip</Button>
                    <Button size="sm" onClick={() => (isLast ? finish() : setStep(step + 1))}>
                        {isLast ? "Get started" : "Next"}
                    </Button>
                </CredenzaFooter>
            </CredenzaContent>
        </Credenza>
    )
}
