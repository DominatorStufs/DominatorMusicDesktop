"use client";
// Small badge showing which source a track came from.
// New component - no existing file was modified.

import { cn } from "@/lib/utils";

const STYLES = {
    saavn: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    innertube: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30",
    piped: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30",
    invidious: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
    audius: "bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400 border-fuchsia-500/30",
    itunes: "bg-pink-500/15 text-pink-600 dark:text-pink-400 border-pink-500/30",
    "itunes-preview": "bg-pink-500/15 text-pink-600 dark:text-pink-400 border-pink-500/30",
    "apple-music-preview": "bg-pink-500/15 text-pink-600 dark:text-pink-400 border-pink-500/30",
    "saavn-fallback": "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
    "saavn-match": "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
    deezer: "bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/30",
    spotify: "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30",
};

export const LABELS = {
    saavn: "JioSaavn",
    innertube: "YouTube Music",
    piped: "YouTube",
    invidious: "YouTube (Invidious)",
    audius: "Audius",
    itunes: "Apple Music",
    "itunes-preview": "Apple Music preview",
    "apple-music-preview": "Apple Music preview",
    "saavn-fallback": "JioSaavn (fallback)",
    // What resolveStream reports when it matched the track onto JioSaavn
    // because the chosen source could not serve the audio.
    "saavn-match": "JioSaavn",
    "spotify-preview": "Spotify preview",
    "deezer-preview": "Deezer preview",
    deezer: "Deezer",
    spotify: "Spotify",
};

/** Human-readable name for a source id, safe to use in client components. */
export const sourceLabel = (source) => LABELS[source] || source;

export default function SourceBadge({ source, className, children }) {
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium leading-none",
                STYLES[source] || "bg-secondary text-muted-foreground border-border",
                className
            )}
        >
            <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
            {children || LABELS[source] || source}
        </span>
    );
}
