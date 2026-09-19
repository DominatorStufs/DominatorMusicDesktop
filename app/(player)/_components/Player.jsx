"use client"
import { Button } from "@/components/ui/button";
import { getSongsById } from "@/lib/fetch";
import { Download, Play, Repeat, Loader2, Repeat1, Link2, SkipBack, SkipForward, Volume2, VolumeX, Mic2 } from "lucide-react";
import LyricsPanel from "@/components/lyrics-panel";
import { useContext, useEffect, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import Link from "next/link";
import { NextContext } from "@/hooks/use-context";
import Next from "@/components/cards/next";
import { useMusic } from "@/components/music-provider";
import { IoPause } from "react-icons/io5";
import ShareStoryButton from "@/components/share-story";
import { Heart } from "lucide-react";
import { isLiked, toggleLiked, addToHistory } from "@/lib/library";
import { logListenSession } from "@/lib/stats";
import { reportNowPlaying, reportScrobble } from "@/hooks/use-lastfm";
import { cn } from "@/lib/utils";
import { extractDominantColor } from "@/lib/color-extract";
import { loadUnifiedSong, isUnifiedId, normalizeId, sourceOf } from "@/lib/unified-song";
import SourceBadge, { sourceLabel } from "@/components/source-badge";
import { decodeEntities } from "@/lib/text";

export default function Player({ id: routeId }) {
    // The route segment may arrive percent-encoded ("innertube%3Axyz").
    const id = normalizeId(routeId);
    const [data, setData] = useState([]);
    const [loadError, setLoadError] = useState(false);
    const [truncated, setTruncated] = useState(false);
    // A 30s Spotify/Deezer preview. Like `truncated`, this means the audio is
    // shorter than the real track, so reaching its end is NOT the song ending.
    const [preview, setPreview] = useState(false);
    // Spotify / Deezer: catalogue-only by design, not a failed source.
    const [metadataOnly, setMetadataOnly] = useState(false);
    const [playing, setPlaying] = useState(true);
    const audioRef = useRef(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isDownloading, setIsDownloading] = useState(false);
    const [lyricsOpen, setLyricsOpen] = useState(false);
    const [isLooping, setIsLooping] = useState(false);
    const [audioURL, setAudioURL] = useState("");
    const [liked, setLiked] = useState(false);
    const [volume, setVolume] = useState(1);
    const [muted, setMuted] = useState(false);
    const next = useContext(NextContext);
    const { current, setCurrent } = useMusic();
    const songInfoRef = useRef(null);
    const listenedRef = useRef(0);
    const lastTimeRef = useRef(0);
    const [bgColor, setBgColor] = useState(null);
    // The source the user picked, and where the audio actually came from.
    // These differ when a fallback kicked in, and the UI must show BOTH rather
    // than silently replacing the first with the second.
    const [songSource, setSongSource] = useState(null);
    const [playbackSource, setPlaybackSource] = useState(null);

    const getSong = async () => {
        // --- Any prefixed id ("innertube:", "piped:", "spotify:", "deezer:",
        // "saavn:") goes through the unified layer, which knows how to reach
        // each source and falls back only when the chosen one cannot serve the
        // audio. Only a bare, legacy JioSaavn id skips this.
        if (isUnifiedId(id)) {
            try {
                const song = await loadUnifiedSong(id);
                if (!song) {
                    setLoadError(true);
                    toast.error("Could not reach the music server", {
                        description: "Check your connection and try again.",
                        action: { label: "Retry", onClick: () => getSong() },
                    });
                    return;
                }
                // Metadata may be available even when no stream resolves, so
                // still render the song instead of an endless skeleton.
                if (!song.audioUrl) {
                    setData(song);
                    setLoadError(true);
                    toast.error(`No playable source for "${song.name}"`, {
                        description: `${sourceLabel(sourceOf(id))} could not stream it, and no match was found on JioSaavn.`,
                        action: { label: "Retry", onClick: () => getSong() },
                    });
                    extractDominantColor(song.image?.[2]?.url).then(setBgColor);
                    return;
                }
                setLoadError(false);
                setTruncated(Boolean(song.truncated));
                setPreview(Boolean(song.preview));
                setMetadataOnly(Boolean(song.metadataOnly));
                setData(song);
                setAudioURL(song.audioUrl);
                setSongSource(song.requestedSource || sourceOf(id));
                setPlaybackSource(song.playbackSource || song.source);
                setLiked(isLiked(song.id));
                songInfoRef.current = { id: song.id, name: song.name, artist: song.artists.primary[0].name, album: song.album?.name || "", duration: song.duration || 0 };
                addToHistory({
                    id: song.id,
                    name: song.name,
                    artist: song.artists.primary[0].name,
                    image: song.image?.[1]?.url || ""
                });
                extractDominantColor(song.image?.[2]?.url).then(setBgColor);

                if (song.fromCache) {
                    // Already announced when the track was first resolved.
                } else if (song.substituted && song.matchedTo) {
                    // The requested source could not serve the audio, so a
                    // different recording is playing. Say so plainly.
                    toast(
                        song.metadataOnly
                            ? `Playing the full track from JioSaavn`
                            : `Playing a matching version from JioSaavn`,
                        {
                            description: song.metadataOnly
                                // Spotify and Deezer only publish catalogue data
                                // and 30s previews, so matching to a full-length
                                // recording is the intended behaviour, not a fault.
                                ? `${song.substitutedFrom || "That service"} does not offer full tracks, so "${song.matchedTo.name}" by ${song.matchedTo.artist} is playing.`
                                : `${song.substitutedFrom || "That source"} could not stream this track, so "${song.matchedTo.name}" by ${song.matchedTo.artist} is playing instead.`,
                            duration: 7000,
                        }
                    );
                } else if (song.preview) {
                    toast("Preview only - 30 seconds", {
                        description: "No full-length version of this track could be found.",
                        duration: 6000,
                    });
                } else if (song.truncated) {
                    // googlevideo only serves the first ~1MB to a server IP,
                    // so tell the user instead of letting it stop silently.
                    toast("Preview only - about 1 minute", {
                        description:
                            "YouTube serves only the first minute to this server. Playback will stop there rather than skipping to a different recording.",
                        duration: 7000,
                    });
                }

                if ("mediaSession" in navigator) {
                    navigator.mediaSession.metadata = new MediaMetadata({
                        title: song.name,
                        artist: song.artists.primary[0].name,
                        album: song.album?.name || "",
                        artwork: [{ src: song.image?.[2]?.url || "", sizes: "500x500", type: "image/jpeg" }]
                    });
                }
            } catch (e) {
                setLoadError(true);
                toast.error("Failed to load song!");
            }
            return;
        }

        // --- Original JioSaavn path (unchanged) ---
        try {
            const get = await getSongsById(id);
            const data = await get.json();
            const song = data?.data?.[0];
            setData(song || []);
            setSongSource("saavn");
            setPlaybackSource("saavn");
            setTruncated(false);
            setPreview(false);
            setMetadataOnly(false);
            const urls = song?.downloadUrl || [];
            // Try highest quality first
            setAudioURL(urls[4]?.url || urls[3]?.url || urls[2]?.url || urls[1]?.url || urls[0]?.url || "");
            if (song?.id) {
                setLiked(isLiked(song.id));
                songInfoRef.current = { id: song.id, name: song.name, artist: song.artists?.primary?.[0]?.name || "unknown", album: song.album?.name || "", duration: song.duration || 0 };
                addToHistory({
                    id: song.id,
                    name: song.name,
                    artist: song.artists?.primary?.[0]?.name || "unknown",
                    image: song.image?.[1]?.url || ""
                });
            }

            const artUrl = song?.image?.[2]?.url || song?.image?.[1]?.url;
            extractDominantColor(artUrl).then(setBgColor);

            // Media Session API — shows song info + controls on lock screen / OS notification
            if ("mediaSession" in navigator && song) {
                navigator.mediaSession.metadata = new MediaMetadata({
                    title: song.name || "Unknown",
                    artist: song.artists?.primary?.[0]?.name || "Unknown",
                    album: song.album?.name || "",
                    artwork: [{ src: song.image?.[2]?.url || "", sizes: "500x500", type: "image/jpeg" }]
                });
                navigator.mediaSession.setActionHandler("pause", () => { audioRef.current?.pause(); });
                navigator.mediaSession.setActionHandler("play", () => { audioRef.current?.play(); });
                navigator.mediaSession.setActionHandler("nexttrack", () => {
                    if (next?.nextData?.id) window.location.href = `/${encodeURIComponent(normalizeId(next.nextData.id))}`;
                });
                navigator.mediaSession.setActionHandler("previoustrack", () => {
                    if (audioRef.current) audioRef.current.currentTime = 0;
                });
            }
        } catch (e) {
            toast.error("Failed to load song!");
        }
    };

    const handleLike = () => {
        if (!data?.id) return;
        const nowLiked = toggleLiked({
            id: data.id,
            name: data.name,
            artist: data.artists?.primary?.[0]?.name || "unknown",
            image: data.image?.[1]?.url || ""
        });
        setLiked(nowLiked);
        toast(nowLiked ? "❤️ Added to Liked Songs" : "Removed from Liked Songs");
    };

    const formatTime = (time) => {
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };

    const togglePlayPause = () => {
        if (playing) {
            audioRef.current.pause();
            localStorage.setItem("p", "false");
        } else {
            audioRef.current.play();
            localStorage.setItem("p", "true");
        }
        setPlaying(!playing);
    };

    const downloadSong = async () => {
        setIsDownloading(true);
        try {
            const response = await fetch(audioURL);
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${data?.name || "song"}.mp3`;
            a.click();
            URL.revokeObjectURL(url);
            toast.success('Downloaded!');
        } catch (e) {
            toast.error("Download failed");
        }
        setIsDownloading(false);
    };

    const handleSeek = (e) => {
        const seekTime = e[0];
        audioRef.current.currentTime = seekTime;
        setCurrentTime(seekTime);
    };

    const loopSong = () => {
        audioRef.current.loop = !audioRef.current.loop;
        setIsLooping(!isLooping);
        toast(isLooping ? "Loop off" : "Loop on");
    };

    const handleShare = async () => {
        // Composite ids ("innertube:abc") must be encoded or the shared link
        // breaks when opened.
        const url = `https://${window.location.host}/${encodeURIComponent(normalizeId(data.id))}`;
        const artistName = data?.artists?.primary?.[0]?.name || "unknown";
        try {
            if (navigator.share) {
                await navigator.share({ title: `${data.name} — ${artistName}`, url });
            } else if (navigator.clipboard) {
                await navigator.clipboard.writeText(url);
                toast.success("Link copied");
            }
        } catch (e) { }
    };

    const handleVolume = (val) => {
        const v = val[0];
        setVolume(v);
        audioRef.current.volume = v;
        setMuted(v === 0);
    };

    const toggleMute = () => {
        const newMuted = !muted;
        setMuted(newMuted);
        audioRef.current.muted = newMuted;
    };

    const skipToNext = () => {
        if (next?.nextData?.id) window.location.href = `/${encodeURIComponent(normalizeId(next.nextData.id))}`;
    };

    useEffect(() => {
        setLoadError(false);
        setTruncated(false);
        setPreview(false);
        setMetadataOnly(false);
        setData([]);
        getSong();
        localStorage.setItem("last-played", id);
        localStorage.removeItem("p");
        listenedRef.current = 0;
        lastTimeRef.current = 0;
        if (current) {
            audioRef.current.currentTime = parseFloat(current + 1);
        }
        const handleTimeUpdate = () => {
            try {
                const cur = audioRef.current.currentTime;
                if (cur > lastTimeRef.current) {
                    listenedRef.current += (cur - lastTimeRef.current);
                }
                lastTimeRef.current = cur;
                setCurrentTime(cur);
                setDuration(audioRef.current.duration);
                setCurrent(cur);
            } catch (e) {
                setPlaying(false);
            }
        };
        audioRef.current.addEventListener('timeupdate', handleTimeUpdate);
        return () => {
            if (audioRef.current) {
                audioRef.current.removeEventListener('timeupdate', handleTimeUpdate);
            }
            if (songInfoRef.current) {
                logListenSession(songInfoRef.current, listenedRef.current);
                // Last.fm decides for itself whether this play qualifies.
                reportScrobble(songInfoRef.current, listenedRef.current);
            }
        };
    }, [id]);

    // Announce the track to Last.fm once playback really begins.
    const nowPlayingSentRef = useRef(null);
    useEffect(() => {
        if (!playing || !data?.id) return;
        if (nowPlayingSentRef.current === data.id) return;
        nowPlayingSentRef.current = data.id;
        reportNowPlaying({
            name: data.name,
            artist: data?.artists?.primary?.[0]?.name || "",
            album: data?.album?.name || "",
            duration: data?.duration || 0,
        });
    }, [playing, data?.id]);

    // Auto-advance when the track genuinely finishes.
    //
    // This must NOT fire for a truncated YouTube stream. googlevideo only
    // serves the first ~1MB to a datacenter IP, so playback stops around the
    // one-minute mark while `duration` still reports the full length. The old
    // condition treated that as "song over" and navigated to the next track -
    // which for a YouTube song is a JioSaavn recommendation. The user saw their
    // YouTube song turn into a JioSaavn one a minute after pressing play, and
    // on expanding the player the badge confirmed JioSaavn, because by then a
    // different song really was loaded.
    useEffect(() => {
        if (isLooping || duration === 0) return;
        // No stream yet - any duration seen here is not this song's.
        if (!audioURL) return;
        if (truncated || preview) return;
        // Guard against float jitter rather than requiring exact equality.
        if (duration - currentTime > 0.5) return;
        if (next?.nextData?.id) {
            window.location.href = `/${encodeURIComponent(normalizeId(next.nextData.id))}`;
        }
    }, [currentTime, duration, isLooping, truncated, preview, audioURL, next?.nextData?.id]);

    return (
        <div
            className="mb-3 mt-10 pt-6 -mt-6 transition-colors duration-700"
            style={bgColor ? {
                background: `linear-gradient(to bottom, rgba(${bgColor.r},${bgColor.g},${bgColor.b},0.18), transparent 420px)`
            } : undefined}
        >
            {/*
              * `src` must be omitted entirely until a real URL exists.
              *
              * Rendering src="" makes the browser resolve the empty string
              * against the current document, so <audio> tried to load the HTML
              * page itself as audio. That fired `error`, and on some tracks it
              * produced a bogus `duration`, which tripped the auto-advance
              * effect: the page immediately navigated to the next (JioSaavn)
              * recommendation while the real stream was still resolving. The
              * user picked a Spotify or YouTube track and landed on a JioSaavn
              * one within a second, before any badge could even render.
              */}
            <audio
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onLoadedData={() => setDuration(audioRef.current.duration)}
                autoPlay={playing}
                {...(audioURL ? { src: audioURL } : {})}
                ref={audioRef}
            />
            <div className="grid gap-6 w-full">
                <div className="sm:flex px-4 sm:px-6 md:px-12 lg:px-20 xl:px-28 grid gap-5 sm:gap-8 w-full">
                    <div className="sm:flex-shrink-0">
                        {!data?.id && loadError ? (
                            <div className="w-full sm:w-[200px] sm:h-[200px] aspect-square rounded-2xl bg-secondary/50 flex items-center justify-center">
                                <span className="text-3xl">!</span>
                            </div>
                        ) : !data?.id ? (
                            <Skeleton className="w-full sm:w-[200px] sm:h-[200px] aspect-square rounded-2xl" />
                        ) : (
                            <div className="relative">
                                <img
                                    src={data?.image?.[2]?.url || ""}
                                    className="w-full sm:w-[200px] sm:h-[200px] aspect-square bg-secondary/50 rounded-2xl sm:mx-0 mx-auto object-cover shadow-lg"
                                />
                                <img
                                    src={data?.image?.[2]?.url || ""}
                                    className="hidden dark:block absolute top-0 left-0 w-[110%] h-[110%] blur-3xl -z-10 opacity-50"
                                />
                            </div>
                        )}
                    </div>

                    {!data?.id && loadError ? (
                        <div className="flex flex-col justify-center w-full gap-3 py-4">
                            <div>
                                <h1 className="text-base font-medium">Couldn\'t load this song</h1>
                                <p className="text-xs text-muted-foreground mt-1">
                                    The source didn\'t return this track. Try another result from search.
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <Button size="sm" variant="secondary" onClick={() => { setLoadError(false); getSong(); }}>
                                    Retry
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => window.location.href = "/"}>
                                    Go home
                                </Button>
                            </div>
                        </div>
                    ) : !data?.id ? (
                        <div className="flex flex-col justify-between w-full">
                            <div>
                                <Skeleton className="h-4 w-36 mb-2" />
                                <Skeleton className="h-3 w-16 mb-4" />
                            </div>
                            <div>
                                <Skeleton className="h-4 w-full rounded-full mb-2" />
                                <div className="w-full flex items-center justify-between">
                                    <Skeleton className="h-[9px] w-6" />
                                    <Skeleton className="h-[9px] w-6" />
                                </div>
                                <div className="flex items-center gap-3 mt-3">
                                    <Skeleton className="h-10 w-10" />
                                    <Skeleton className="h-10 w-10" />
                                    <Skeleton className="h-10 w-10" />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col justify-between w-full">
                            <div className="sm:mt-0 mt-3 flex items-start justify-between gap-2">
                                <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h1 className="text-xl sm:text-2xl font-bold tracking-tight md:max-w-lg break-words">{decodeEntities(data.name)}</h1>
                                        {songSource && songSource !== "saavn" && (
                                            <SourceBadge source={songSource} />
                                        )}
                                        {playbackSource &&
                                            songSource &&
                                            sourceLabel(playbackSource) !== sourceLabel(songSource) && (
                                                <span
                                                    className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-500 border border-blue-500/30 whitespace-nowrap"
                                                    title={metadataOnly
                                                        ? `${sourceLabel(songSource)} only provides catalogue data, so the full track is playing from ${sourceLabel(playbackSource)}.`
                                                        : `${sourceLabel(songSource)} could not stream this track, so it is playing from ${sourceLabel(playbackSource)}.`}
                                                >
                                                    via {sourceLabel(playbackSource)}
                                                </span>
                                            )}
                                        {preview && !truncated && (
                                            <span
                                                className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-500 border border-amber-500/30 whitespace-nowrap"
                                                title="Only a 30-second preview is available for this track. Playback stops there rather than skipping to a different recording."
                                            >
                                                Preview 30s
                                            </span>
                                        )}
                                        {truncated && (
                                            <span
                                                className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-500 border border-amber-500/30 whitespace-nowrap"
                                                title="YouTube only serves the first minute to this server. Playback stops there and will not skip to another track."
                                            >
                                                Preview ~1 min
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        by{" "}
                                        <Link
                                            href={"/search/" + `${encodeURI((data?.artists?.primary?.[0]?.name || "unknown").toLowerCase().split(" ").join("+"))}`}
                                            className="text-foreground"
                                        >
                                            {decodeEntities(data?.artists?.primary?.[0]?.name) || "unknown"}
                                        </Link>
                                    </p>
                                </div>
                                <Button
                                    size="icon"
                                    variant={!liked ? "ghost" : "secondary"}
                                    onClick={handleLike}
                                    className="flex-shrink-0"
                                >
                                    <Heart className={cn("h-4 w-4 transition", liked && "fill-red-500 text-red-500")} />
                                </Button>
                            </div>

                            <div className="grid gap-2 w-full mt-5 sm:mt-0">
                                <Slider onValueChange={handleSeek} value={[currentTime]} max={duration} className="w-full" />
                                <div className="w-full flex items-center justify-between">
                                    <span className="text-sm">{formatTime(currentTime)}</span>
                                    <span className="text-sm">{formatTime(duration)}</span>
                                </div>

                                {/* Playback controls */}
                                <div className="flex items-center mt-1 justify-between w-full sm:mt-2">
                                    <div className="flex items-center gap-1">
                                        <Button size="icon" variant="ghost" onClick={() => { if (audioRef.current) audioRef.current.currentTime = 0; }}>
                                            <SkipBack className="h-4 w-4" />
                                        </Button>
                                        <Button variant={playing ? "default" : "secondary"} className="gap-1 rounded-full px-4" onClick={togglePlayPause}>
                                            {playing ? <IoPause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                                            {playing ? "Pause" : "Play"}
                                        </Button>
                                        <Button size="icon" variant="ghost" onClick={skipToNext}>
                                            <SkipForward className="h-4 w-4" />
                                        </Button>
                                    </div>

                                    <div className="flex items-center gap-1 sm:gap-2">
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            aria-label="Lyrics"
                                            onClick={() => setLyricsOpen(true)}
                                        >
                                            <Mic2 className="h-4 w-4" />
                                        </Button>

                                        <Button size="icon" variant="ghost" onClick={loopSong}>
                                            {!isLooping ? <Repeat className="h-4 w-4" /> : <Repeat1 className="h-4 w-4" />}
                                        </Button>
                                        <Button size="icon" variant="ghost" onClick={downloadSong}>
                                            {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                                        </Button>
                                        <Button size="icon" variant="ghost" onClick={handleShare}>
                                            <Link2 className="h-4 w-4" />
                                        </Button>
                                        <ShareStoryButton
                                            id={data?.id}
                                            name={data?.name}
                                            artist={data?.artists?.primary?.[0]?.name || "unknown"}
                                            image={data?.image?.[2]?.url || data?.image?.[1]?.url}
                                        />
                                    </div>
                                </div>

                                {/* Volume control */}
                                <div className="flex items-center gap-2 mt-1">
                                    <Button size="icon" variant="ghost" className="h-7 w-7 flex-shrink-0" onClick={toggleMute}>
                                        {muted || volume === 0
                                            ? <VolumeX className="h-3.5 w-3.5" />
                                            : <Volume2 className="h-3.5 w-3.5" />
                                        }
                                    </Button>
                                    <Slider
                                        onValueChange={handleVolume}
                                        value={[muted ? 0 : volume]}
                                        max={1}
                                        step={0.01}
                                        className="w-28"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {next.nextData && (
                <div className="mt-10 -mb-3 px-4 sm:px-6 md:px-12 lg:px-20 xl:px-28">
                    <Next
                        name={next.nextData.name}
                        artist={next.nextData.artist}
                        image={next.nextData.image}
                        id={next.nextData.id}
                    />
                </div>
            )}

            <LyricsPanel
                open={lyricsOpen}
                onOpenChange={setLyricsOpen}
                song={data}
                currentTime={currentTime}
                onSeek={(t) => {
                    if (audioRef.current) audioRef.current.currentTime = t;
                }}
            />
        </div>
    );
}
