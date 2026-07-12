"use client"
import { useContext } from "react"
import { MusicContext } from "@/hooks/use-context"
import { useMusic } from "./music-provider"
import Link from "next/link"
import { Radio } from "lucide-react"

// Note: this badge is personal (visible only in your own browser) since the
// app has no shared backend/database to broadcast it publicly to others.
// It's still useful as a quick "what am I playing right now" glanceable tag,
// and the song page itself is shareable if you want others to see/hear it.
export default function NowPlayingBadge() {
    const values = useContext(MusicContext)

    if (!values?.music) return null

    return (
        <Link
            href={`/${values.music}`}
            className="glass-surface hidden sm:flex items-center gap-1.5 px-3 h-8 rounded-full bg-secondary/70 border border-border text-xs text-muted-foreground hover:text-foreground transition"
        >
            <Radio className="h-3 w-3 text-primary animate-pulse" />
            Now Playing
        </Link>
    )
}
