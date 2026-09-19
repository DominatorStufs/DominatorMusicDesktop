"use client";
// ---------------------------------------------------------------------------
// /sources - Multi-source test page.
//
// This page exists so you can SEE which sources are actually working:
// JioSaavn + InnerTube/Metrolist + Piped for audio, and Deezer + Spotify for
// metadata (those two never stream a full track, so they get matched onto
// JioSaavn at playback time).
//
// Here you can:
//   - run a live search and see a source badge on every result
//   - play any track, including YouTube ones
//   - see where the stream was resolved from (and whether a fallback kicked in)
//   - run a health check
//
// This is a new page - none of your existing pages are affected by it.
// ---------------------------------------------------------------------------

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import SourceBadge from "@/components/source-badge";
import { Play, Pause, Loader2, Search as SearchIcon, Activity, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import PageShell from "@/components/page/page-shell";

export default function SourcesPage() {
    const [query, setQuery] = useState("tum hi ho");
    const [results, setResults] = useState([]);
    const [counts, setCounts] = useState({});
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState("all");

    const [nowPlaying, setNowPlaying] = useState(null);
    const [resolving, setResolving] = useState(null);
    const [playInfo, setPlayInfo] = useState(null);
    const audioRef = useRef(null);

    const [health, setHealth] = useState(null);
    const [healthLoading, setHealthLoading] = useState(false);

    const doSearch = async (q) => {
        if (!q?.trim()) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/music/search?q=${encodeURIComponent(q)}&limit=12`);
            const data = await res.json();
            setResults(data.results || []);
            setCounts(data.counts || {});
        } catch {
            toast.error("Search failed");
        }
        setLoading(false);
    };

    useEffect(() => {
        doSearch("tum hi ho");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Try to actually play a URL. Returns false instead of throwing if the
    // browser cannot decode the stream, so the caller can fall back.
    const tryPlay = (url) =>
        new Promise((resolve) => {
            const audio = audioRef.current;
            if (!audio) return resolve(false);

            const cleanup = () => {
                audio.removeEventListener("canplay", onOk);
                audio.removeEventListener("error", onFail);
            };
            const onOk = () => { cleanup(); resolve(true); };
            const onFail = () => { cleanup(); resolve(false); };

            audio.addEventListener("canplay", onOk, { once: true });
            audio.addEventListener("error", onFail, { once: true });

            audio.src = url;
            audio.load();
            audio.play().then(() => { cleanup(); resolve(true); }).catch(() => {
                // Autoplay rejection is not a decode failure - check readyState
                if (audio.readyState >= 2) { cleanup(); resolve(true); }
            });

            setTimeout(() => { cleanup(); resolve(audio.readyState >= 2); }, 9000);
        });

    const playSong = async (song) => {
        if (nowPlaying === song.id) {
            audioRef.current?.pause();
            setNowPlaying(null);
            return;
        }
        setResolving(song.id);
        setPlayInfo(null);
        try {
            const params = new URLSearchParams({ id: song.id, name: song.name, artist: song.artist });
            const res = await fetch(`/api/music/stream?${params}`);
            const data = await res.json();

            if (!data.success || !data.url) {
                toast.error(`No stream found: ${data.error || "unknown error"}`);
                setResolving(null);
                return;
            }

            const needsProxy = ["innertube", "piped", "invidious"].includes(data.resolvedFrom);
            const url = needsProxy ? `/api/music/proxy?url=${encodeURIComponent(data.url)}` : data.url;

            const ok = await tryPlay(url);

            if (!ok) {
                // The browser could not decode this stream (usually a codec the
                // browser does not support). Ask the server for a JioSaavn
                // version of the same song instead of just failing.
                toast.message("Stream not supported, trying JioSaavn...");
                const alt = await fetch(
                    `/api/music/search?q=${encodeURIComponent(`${song.name} ${song.artist}`)}&sources=saavn&limit=1`
                ).then((r) => r.json());

                const match = alt.results?.[0];
                if (match) {
                    const altStream = await fetch(
                        `/api/music/stream?id=${encodeURIComponent(match.id)}`
                    ).then((r) => r.json());

                    if (altStream.url && (await tryPlay(altStream.url))) {
                        setNowPlaying(song.id);
                        setPlayInfo({ id: song.id, ...altStream, resolvedFrom: "saavn-fallback", matchedTo: match });
                        toast.success(`Playing from JioSaavn: ${match.name}`);
                        setResolving(null);
                        return;
                    }
                }
                toast.error("Could not play this track from any source");
                setResolving(null);
                return;
            }

            setNowPlaying(song.id);
            setPlayInfo({ id: song.id, ...data });

            if (data.resolvedFrom === "saavn-fallback") {
                toast.success(`YouTube blocked - played from JioSaavn: ${data.matchedTo?.name || ""}`);
            } else {
                toast.success(`Playing - source: ${data.resolvedFrom}`);
            }
        } catch (e) {
            toast.error("Playback failed: " + e.message);
        }
        setResolving(null);
    };

    const runHealth = async () => {
        setHealthLoading(true);
        try {
            const res = await fetch("/api/music/health");
            setHealth(await res.json());
        } catch {
            toast.error("Health check failed");
        }
        setHealthLoading(false);
    };

    const shown = filter === "all" ? results : results.filter((r) => r.source === filter);

    return (
        <PageShell>
            <audio ref={audioRef} onEnded={() => setNowPlaying(null)} />

            <div className="mb-6">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Multi-Source Test 🎛️</h1>
                <p className="text-sm text-muted-foreground">
                    JioSaavn + YouTube Music (InnerTube / Metrolist approach) + YouTube (Piped) - all three together.
                </p>
            </div>

            {/* ---------------- Search ---------------- */}
            <form
                onSubmit={(e) => { e.preventDefault(); doSearch(query); }}
                className="flex gap-2 mb-4"
            >
                <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search for any song..."
                    className="max-w-md"
                />
                <Button type="submit" disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SearchIcon className="h-4 w-4" />}
                </Button>
                <Button type="button" variant="outline" onClick={runHealth} disabled={healthLoading}>
                    {healthLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
                    <span className="ml-2 hidden sm:inline">Health</span>
                </Button>
            </form>

            {/* ---------------- Source counts ---------------- */}
            <div className="flex flex-wrap gap-2 mb-6">
                <button onClick={() => setFilter("all")}>
                    <SourceBadge source={filter === "all" ? "saavn-fallback" : "none"}>
                        All ({results.length})
                    </SourceBadge>
                </button>
                {["saavn", "audius", "innertube", "piped", "invidious", "deezer", "itunes"].map((s) => (
                    <button key={s} onClick={() => setFilter(s)} className={filter === s ? "ring-2 ring-primary rounded-full" : ""}>
                        <SourceBadge source={s}>
                            {{ saavn: "JioSaavn", audius: "Audius", innertube: "YouTube Music", piped: "YouTube", invidious: "Invidious", deezer: "Deezer", itunes: "Apple Music" }[s]} ({counts[s] ?? 0})
                        </SourceBadge>
                    </button>
                ))}
            </div>

            {/* ---------------- Health panel ---------------- */}
            {health && (
                <div className="mb-6 rounded-lg border bg-secondary/30 p-4">
                    <h2 className="text-sm font-medium mb-3">Live Health Check</h2>
                    <div className="grid gap-2 sm:grid-cols-2">
                        <div>
                            <p className="text-xs text-muted-foreground mb-1">Search working:</p>
                            <div className="flex flex-wrap gap-1">
                                {["saavn", "audius", "innertube", "piped", "invidious", "deezer", "spotify", "itunes"].map((s) => {
                                    const ok = health.summary?.searchWorking?.includes(s);
                                    return (
                                        <span key={s} className="inline-flex items-center gap-1 text-xs">
                                            {ok ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <XCircle className="h-3 w-3 text-red-500" />}
                                            {s}
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground mb-1">Streaming working:</p>
                            <div className="flex flex-wrap gap-2">
                                {(health.streams || []).map((s) => (
                                    <span key={s.source} className="inline-flex items-center gap-1 text-xs">
                                        {s.gotUrl ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <XCircle className="h-3 w-3 text-red-500" />}
                                        {s.source.replace("-stream", "")}
                                        {s.bitrate ? ` (${Math.round(s.bitrate / 1000)}k)` : ""}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                    {(health.previews || []).length > 0 && (
                        <div className="mt-3 pt-3 border-t border-border/60">
                            <p className="text-xs text-muted-foreground mb-1">
                                Metadata sources (30-second previews only):
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {health.previews.map((s) => (
                                    <span key={s.source} className="inline-flex items-center gap-1 text-xs">
                                        {s.gotUrl ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <XCircle className="h-3 w-3 text-red-500" />}
                                        {s.source.replace("-preview", "")}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    <p className="mt-3 text-xs text-muted-foreground">{health.summary?.note}</p>
                </div>
            )}

            {/* ---------------- Results ---------------- */}
            <div className="grid gap-2">
                {loading && !shown.length
                    ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)
                    : shown.map((song) => {
                        const isPlaying = nowPlaying === song.id;
                        const isResolving = resolving === song.id;
                        const info = playInfo?.id === song.id ? playInfo : null;

                        return (
                            <div
                                key={song.id}
                                className={`flex items-center gap-3 rounded-lg border p-3 transition ${isPlaying ? "bg-primary/5 border-primary/40" : "hover:bg-secondary/40"}`}
                            >
                                <img
                                    src={song.image}
                                    alt={song.name}
                                    loading="lazy"
                                    className="h-12 w-12 rounded-lg bg-secondary object-cover"
                                />
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <p className="truncate text-sm font-medium">{song.name}</p>
                                        <SourceBadge source={song.source} />
                                    </div>
                                    <p className="truncate text-xs text-muted-foreground">{song.artist}</p>
                                    {info && (
                                        <p className="mt-1 text-[10px] text-muted-foreground">
                                            resolved via <b>{info.resolvedFrom}</b>
                                            {info.matchedTo ? ` → matched "${info.matchedTo.name}"` : ""}
                                            {info.bitrate ? ` · ${Math.round(info.bitrate / 1000)}kbps` : ""}
                                        </p>
                                    )}
                                </div>
                                <Button size="icon" variant={isPlaying ? "default" : "secondary"} onClick={() => playSong(song)} disabled={isResolving}>
                                    {isResolving ? <Loader2 className="h-4 w-4 animate-spin" /> : isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                                </Button>
                            </div>
                        );
                    })}
                {!loading && !shown.length && (
                    <p className="py-8 text-center text-sm text-muted-foreground">No results found.</p>
                )}
            </div>
        </PageShell>
    );
}
