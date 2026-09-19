"use client"
import { useEffect, useState } from "react"
import {
    Credenza,
    CredenzaContent,
    CredenzaHeader,
    CredenzaTitle,
    CredenzaDescription,
    CredenzaBody,
} from "@/components/ui/credenza"
import { getDueRecap, markRecapShown } from "@/lib/stats"
import { Music2, Clock, Mic2 } from "lucide-react"

export function StatsSummary({ stats }) {
    if (!stats || !stats.songCount) {
        return (
            <p className="text-sm text-muted-foreground text-center py-6">
                Not enough listening yet - play a few songs and check back!
            </p>
        )
    }
    return (
        <div className="grid gap-3">
            <div className="rounded-xl border border-border bg-secondary/50 p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Clock className="h-4 w-4" />
                </div>
                <div>
                    <p className="text-lg font-semibold leading-none">{stats.totalMinutes} min</p>
                    <p className="text-xs text-muted-foreground mt-1">Total listening time</p>
                </div>
            </div>
            {stats.topArtist && (
                <div className="rounded-xl border border-border bg-secondary/50 p-4 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Mic2 className="h-4 w-4" />
                    </div>
                    <div>
                        <p className="text-sm font-medium leading-none">{stats.topArtist}</p>
                        <p className="text-xs text-muted-foreground mt-1">Your top artist</p>
                    </div>
                </div>
            )}
            {stats.topSong && (
                <div className="rounded-xl border border-border bg-secondary/50 p-4 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Music2 className="h-4 w-4" />
                    </div>
                    <div>
                        <p className="text-sm font-medium leading-none">{stats.topSong.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">Your top song - played {stats.topSong.count}x</p>
                    </div>
                </div>
            )}
            <p className="text-xs text-muted-foreground text-center mt-1">{stats.uniqueSongs} different songs this period</p>
        </div>
    )
}

export default function StatsRecap() {
    const [recap, setRecap] = useState(null)
    const [open, setOpen] = useState(false)

    useEffect(() => {
        const due = getDueRecap()
        if (due) {
            setRecap(due)
            // small delay so it doesn't fight with the page's own mount
            const t = setTimeout(() => setOpen(true), 2000)
            return () => clearTimeout(t)
        }
    }, [])

    const handleClose = (isOpen) => {
        setOpen(isOpen)
        if (!isOpen && recap) {
            markRecapShown(recap.type)
        }
    }

    if (!recap) return null

    return (
        <Credenza open={open} onOpenChange={handleClose}>
            <CredenzaContent className="glass-surface">
                <CredenzaHeader>
                    <CredenzaTitle>{recap.type === "weekly" ? "Your Week in Music 🎧" : "Your Month in Music 🎧"}</CredenzaTitle>
                    <CredenzaDescription>
                        {recap.type === "weekly" ? "Here's what you listened to this week" : "Here's your recap for this month"}
                    </CredenzaDescription>
                </CredenzaHeader>
                <CredenzaBody className="pb-8">
                    <StatsSummary stats={recap.stats} />
                </CredenzaBody>
            </CredenzaContent>
        </Credenza>
    )
}
