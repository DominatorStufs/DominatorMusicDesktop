"use client";
// ---------------------------------------------------------------------------
// Time-synced lyrics, scrolling with the track.
//
// Lyrics come from LRCLIB, which is open and needs no key or account. Spotify's
// lyrics are Musixmatch-backed and require an sp_dc cookie, so they are not an
// option for a web app like this one.
//
// The panel degrades gracefully: synced lyrics scroll, plain lyrics are shown
// as a static block, and a track with neither says so.
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState, useMemo } from "react";
import {
    Credenza,
    CredenzaContent,
    CredenzaHeader,
    CredenzaTitle,
    CredenzaDescription,
    CredenzaBody,
} from "@/components/ui/credenza";
import { Mic2, Loader2 } from "lucide-react";

export default function LyricsPanel({ open, onOpenChange, song, currentTime = 0, onSeek }) {
    const [state, setState] = useState({ status: "idle", data: null });
    const activeRef = useRef(null);
    const scrollRef = useRef(null);
    // Suspend auto-scroll briefly after a manual scroll so the user can read.
    const manualUntil = useRef(0);

    const artist = song?.artists?.primary?.[0]?.name || song?.artist || "";
    const track = song?.name || "";
    const album = song?.album?.name || song?.album || "";
    const duration = song?.duration || 0;

    useEffect(() => {
        if (!open || !track || !artist) return;

        let cancelled = false;
        setState({ status: "loading", data: null });

        const params = new URLSearchParams({ artist, track });
        if (album) params.set("album", album);
        if (duration) params.set("duration", String(duration));

        fetch(`/api/music/lyrics?${params}`)
            .then((r) => r.json())
            .then((json) => {
                if (cancelled) return;
                if (json?.success && json.lyrics) setState({ status: "ok", data: json.lyrics });
                else setState({ status: "empty", data: null });
            })
            .catch(() => {
                if (!cancelled) setState({ status: "error", data: null });
            });

        return () => {
            cancelled = true;
        };
    }, [open, track, artist, album, duration]);

    const lines = state.data?.lines || [];

    // Which line is playing right now: the last one whose timestamp has passed.
    const activeIndex = useMemo(() => {
        if (!lines.length) return -1;
        let lo = 0;
        let hi = lines.length - 1;
        let found = -1;
        while (lo <= hi) {
            const mid = (lo + hi) >> 1;
            if (lines[mid].time <= currentTime) {
                found = mid;
                lo = mid + 1;
            } else {
                hi = mid - 1;
            }
        }
        return found;
    }, [lines, currentTime]);

    // Keep the active line centred, unless the user just scrolled by hand.
    useEffect(() => {
        if (!open || activeIndex < 0) return;
        if (Date.now() < manualUntil.current) return;
        activeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, [activeIndex, open]);

    return (
        <Credenza open={open} onOpenChange={onOpenChange}>
            <CredenzaContent className="glass-surface">
                <CredenzaHeader>
                    <CredenzaTitle className="flex items-center gap-2">
                        <Mic2 className="h-4 w-4" /> Lyrics
                    </CredenzaTitle>
                    <CredenzaDescription className="truncate">
                        {track} {artist ? `— ${artist}` : ""}
                    </CredenzaDescription>
                </CredenzaHeader>

                <CredenzaBody className="pb-6">
                    {state.status === "loading" && (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                    )}

                    {(state.status === "empty" || state.status === "error") && (
                        <div className="text-center py-14">
                            <Mic2 className="h-7 w-7 mx-auto text-muted-foreground/50" />
                            <p className="text-sm font-medium mt-3">
                                {state.status === "error" ? "Could not load lyrics" : "No lyrics found"}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                                Nothing for this track in the LRCLIB database yet.
                            </p>
                        </div>
                    )}

                    {state.status === "ok" && (
                        <>
                            {/* ---- synced ---- */}
                            {lines.length > 0 ? (
                                <div
                                    ref={scrollRef}
                                    onWheel={() => (manualUntil.current = Date.now() + 4000)}
                                    onTouchMove={() => (manualUntil.current = Date.now() + 4000)}
                                    className="max-h-[55vh] overflow-y-auto py-4 px-1 space-y-1"
                                >
                                    {lines.map((line, i) => {
                                        const active = i === activeIndex;
                                        const past = i < activeIndex;
                                        return (
                                            <p
                                                key={`${line.time}-${i}`}
                                                ref={active ? activeRef : null}
                                                onClick={() => onSeek?.(line.time)}
                                                className={`cursor-pointer rounded px-2 py-1.5 leading-snug transition-all duration-300 ${active
                                                    ? "text-base font-semibold text-foreground scale-[1.02] origin-left"
                                                    : past
                                                        ? "text-sm text-muted-foreground/45"
                                                        : "text-sm text-muted-foreground/75"
                                                    } ${line.text ? "" : "h-3"}`}
                                            >
                                                {line.text || "\u00a0"}
                                            </p>
                                        );
                                    })}
                                </div>
                            ) : (
                                /* ---- plain text only ---- */
                                <div className="max-h-[55vh] overflow-y-auto py-2">
                                    <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
                                        {state.data.plain || "These lyrics have no text."}
                                    </p>
                                </div>
                            )}

                            <p className="text-[11px] text-muted-foreground text-center pt-3 border-t border-border/60 mt-2">
                                {lines.length > 0 ? "Tap a line to jump there · " : ""}
                                Lyrics by {state.data.provider}
                            </p>
                        </>
                    )}
                </CredenzaBody>
            </CredenzaContent>
        </Credenza>
    );
}
