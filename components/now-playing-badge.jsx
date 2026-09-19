"use client"
import { useContext, useEffect, useState } from "react"
import { MusicContext } from "@/hooks/use-context"
import Link from "next/link"
import { normalizeId, sourceOf } from "@/lib/unified-song"
import { Radio } from "lucide-react"
import { sourceLabel } from "@/components/source-badge"

// Note: this badge is personal (visible only in your own browser) since the
// app has no shared backend/database to broadcast it publicly to others.
// It's still useful as a quick "what am I playing right now" glanceable tag,
// and the song page itself is shareable if you want others to see/hear it.
//
// It shows the source the track was picked from, so the tag reads
// "Now Playing - Spotify" rather than just "Now Playing".
export default function NowPlayingBadge() {
    const values = useContext(MusicContext)
    const id = values?.music
    const [label, setLabel] = useState(null)

    useEffect(() => {
        if (!id) {
            setLabel(null)
            return
        }
        // The chosen source is known from the id alone, so the tag is correct
        // immediately and never has to wait on the resolver.
        const chosen = sourceOf(id)
        setLabel(chosen === "saavn" ? null : sourceLabel(chosen))
    }, [id])

    if (!id) return null

    return (
        <Link
            href={`/${encodeURIComponent(normalizeId(id))}`}
            className="glass-surface flex items-center gap-1.5 px-3 h-8 rounded-full bg-secondary/70 border border-border text-xs text-muted-foreground hover:text-foreground transition flex-shrink-0 max-w-[60vw] sm:max-w-none"
            title={label ? `Now playing from ${label}` : "Now playing"}
        >
            <Radio className="h-3 w-3 text-primary animate-pulse flex-shrink-0" />
            <span className="truncate">
                Now Playing
                {label && (
                    <span className="text-foreground/80"> · {label}</span>
                )}
            </span>
        </Link>
    )
}
