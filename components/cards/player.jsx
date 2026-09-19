"use client";
import { useContext, useEffect, useRef, useState } from "react";
import { Button } from "../ui/button";
import { ExternalLink, Link2Icon, Pause, PauseCircle, Play, Repeat, Repeat1, X } from "lucide-react";
import { Slider } from "../ui/slider";
import { getSongsById } from "@/lib/fetch";
import Link from "next/link";
import { MusicContext } from "@/hooks/use-context";
import { toast } from "sonner";
import { Skeleton } from "../ui/skeleton";
import { IoPause } from "react-icons/io5";
import { useMusic } from "../music-provider";
import { Heart } from "lucide-react";
import { isLiked, toggleLiked, addToHistory } from "@/lib/library";
import { logListenSession } from "@/lib/stats";
import { reportNowPlaying, reportScrobble } from "@/hooks/use-lastfm";
import { cn } from "@/lib/utils";
import { loadUnifiedSong, isUnifiedId, normalizeId, sourceOf } from "@/lib/unified-song";
import SourceBadge, { sourceLabel } from "@/components/source-badge";

export default function Player() {
    const [data, setData] = useState([]);
    const [playing, setPlaying] = useState(false);
    const audioRef = useRef(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [audioURL, setAudioURL] = useState("");
    const [isLooping, setIsLooping] = useState(false);
    const [liked, setLiked] = useState(false);
    // The source the user picked, and where the audio actually came from.
    const [songSource, setSongSource] = useState(null);
    const [playbackSource, setPlaybackSource] = useState(null);
    const values = useContext(MusicContext);
    const songInfoRef = useRef(null);
    const listenedRef = useRef(0);
    const lastTimeRef = useRef(0);

    const getSong = async () => {
        // Every prefixed id ("innertube:", "spotify:", "deezer:", ...) resolves
        // through the unified layer. Only a bare legacy JioSaavn id does not.
        if (isUnifiedId(values.music)) {
            try {
                const song = await loadUnifiedSong(values.music);
                if (!song) {
                    toast.error("Could not reach the music server", {
                        description: "Check your connection and try again.",
                        action: { label: "Retry", onClick: () => getSong() },
                    });
                    return;
                }
                if (!song.audioUrl) {
                    toast.error(`No playable source for "${song.name}"`, {
                        description: `${sourceLabel(sourceOf(values.music))} could not stream it, and no match was found on JioSaavn.`,
                        action: { label: "Retry", onClick: () => getSong() },
                    });
                    return;
                }
                setData(song);
                setAudioURL(song.audioUrl);
                setSongSource(song.requestedSource || sourceOf(values.music));
                setPlaybackSource(song.playbackSource || song.source);
                setLiked(isLiked(song.id));
                if (!song.fromCache && song.substituted && song.matchedTo) {
                    // Say it once, here, rather than letting the full-screen
                    // view repeat it on expand.
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
                }
                songInfoRef.current = { id: song.id, name: song.name, artist: song.artists.primary[0].name, album: song.album?.name || "", duration: song.duration || 0 };
                addToHistory({
                    id: song.id,
                    name: song.name,
                    artist: song.artists.primary[0].name,
                    image: song.image?.[1]?.url || ""
                });
            } catch (e) {
                toast.error("Failed to load song!");
            }
            return;
        }

        try {
            const get = await getSongsById(values.music);
            const data = await get.json();
            const song = data?.data?.[0];
            setData(song || []);
            setSongSource("saavn");
            setPlaybackSource("saavn");
            const urls = song?.downloadUrl || [];
            setAudioURL(urls[2]?.url || urls[1]?.url || urls[0]?.url || "");
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
    };

    const formatTime = (time) => {
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };

    const togglePlayPause = () => {
        if (playing) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
        setPlaying(!playing);
    };

    const handleSeek = (e) => {
        const seekTime = e[0];
        audioRef.current.currentTime = seekTime;
        setCurrentTime(seekTime);
    };

    const loopSong = () => {
        audioRef.current.loop = !audioRef.current.loop;
        setIsLooping(!isLooping);
    };

    const { current, setCurrent } = useMusic();
    // Announce to Last.fm once playback actually starts.
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

    useEffect(() => {
        if (values.music) {
            getSong();
            listenedRef.current = 0;
            lastTimeRef.current = 0;
            if (current) {
                audioRef.current.currentTime = parseFloat(current + 1);
            }
            setPlaying(localStorage.getItem("p") == "true" && true || !localStorage.getItem("p") && true);
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
                }
                catch (e) {
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
                    reportScrobble(songInfoRef.current, listenedRef.current);
                }
            };
        }
    }, [values.music]);
    return (
        <main>
            {/* Omit `src` until it is real - an empty src makes the browser try to
                play the current HTML page as audio. */}
            <audio autoPlay={playing} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onLoadedData={() => setDuration(audioRef.current.duration)} {...(audioURL ? { src: audioURL } : {})} ref={audioRef}></audio>
            {values.music && <div className="player-bar glass-surface shadow-lg fixed grid grid-cols-1 bottom-0 w-full max-w-[500px] md:border-l md:border-r md:rounded-md md:!rounded-b-none md:ml-auto right-0 left-0 border-border overflow-hidden border-t-none z-50 bg-background gap-3 transition-all duration-300">
                <div className="w-full">
                    {!duration ? <Skeleton className="h-1 w-full" /> : (
                        <Slider thumbClassName="hidden" trackClassName="h-1 transition-[height] group-hover:h-2 rounded-none" onValueChange={handleSeek} value={[currentTime]} max={duration} className="w-full group" />
                    )}
                </div>
                <div className="grid grid-cols-1 gap-2 p-3 pt-0 min-w-0">
                    <div className="flex items-center justify-between gap-2 sm:gap-3 min-w-0">
                        <div className="relative flex items-center gap-2.5 min-w-0 flex-1">
                            <img src={data?.image?.[1]?.url || ""} alt={data?.name} className="rounded-lg aspect-square h-12 w-12 flex-shrink-0 bg-secondary hover:opacity-85 transition cursor-pointer object-cover" />
                            <img src={data?.image?.[1]?.url || ""} alt={data?.name} className="rounded-md h-[110%] min-w-[110%] opacity-40 hidden dark:block absolute top-0 left-0 right-0 blur-3xl -z-10" />
                            <div className="min-w-0 flex-1">
                                {!data?.name ? <Skeleton className="h-4 w-32" /> : (
                                    <Link
                                        href={`/${encodeURIComponent(normalizeId(values.music))}`}
                                        className="text-sm sm:text-base hover:opacity-85 transition font-medium flex gap-1.5 items-center min-w-0"
                                        title={data.name}
                                    >
                                        <span className="truncate">{data.name}</span>
                                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                    </Link>
                                )}
                                {!data?.artists?.primary?.[0]?.name ? <Skeleton className="h-3 w-14 mt-1" /> : (
                                    <div className="flex items-center gap-1.5 min-w-0 -mt-0.5 overflow-hidden">
                                        <h2 className="text-xs text-muted-foreground truncate min-w-[3.5rem]">
                                            {data.artists.primary[0].name}
                                        </h2>
                                        {/* The badges must be allowed to shrink and truncate. Pinning
                                            them with flex-shrink-0 pushed the whole row past the right
                                            edge of the bar on narrow phones. */}
                                        {songSource && songSource !== "saavn" && (
                                            <SourceBadge source={songSource} className="flex-shrink-0" />
                                        )}
                                        {playbackSource &&
                                            songSource &&
                                            sourceLabel(playbackSource) !== sourceLabel(songSource) && (
                                                <span
                                                    className="hidden min-[440px]:inline-block flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-500 border border-blue-500/30 whitespace-nowrap"
                                                    title={`${sourceLabel(songSource)} could not stream this track, so it is playing from ${sourceLabel(playbackSource)}.`}
                                                >
                                                    via {sourceLabel(playbackSource)}
                                                </span>
                                            )}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-0.5 sm:gap-1.5 flex-shrink-0">
                            <Button size="icon" className="p-0 h-8 w-8 sm:h-9 sm:w-9" variant={!liked ? "ghost" : "secondary"} onClick={handleLike}>
                                <Heart className={cn("h-3.5 w-3.5 transition", liked && "fill-red-500 text-red-500")} />
                            </Button>
                            <Button size="icon" className="p-0 h-8 w-8 sm:h-9 sm:w-9" variant={!isLooping ? "ghost" : "secondary"} onClick={loopSong}>
                                {!isLooping ? <Repeat className="h-3.5 w-3.5" /> : <Repeat1 className="h-3.5 w-3.5" />}
                            </Button>
                            <Button size="icon" className="p-0 h-8 w-8 sm:h-9 sm:w-9" onClick={togglePlayPause}>{playing ? <IoPause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</Button>
                            <Button size="icon" className="p-0 h-8 w-8 sm:h-9 sm:w-9" variant="secondary" onClick={() => { values.setMusic(null); setCurrent(0); localStorage.removeItem("last-played"); localStorage.removeItem("p"); audioRef.current.currentTime = 0; audioRef.current.src = null; setAudioURL(null); }}>
                                <X className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>}
        </main >
    )
}
