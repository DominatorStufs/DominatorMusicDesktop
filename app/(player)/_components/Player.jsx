"use client"
import { Button } from "@/components/ui/button";
import { getSongsById } from "@/lib/fetch";
import { Download, Play, Repeat, Loader2, Repeat1, Link2, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { useEqualizer } from "@/hooks/use-equalizer";
import EqualizerButton from "@/components/equalizer-button";
import { extractDominantColor } from "@/lib/color-extract";

export default function Player({ id }) {
    const [data, setData] = useState([]);
    const [playing, setPlaying] = useState(true);
    const audioRef = useRef(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isDownloading, setIsDownloading] = useState(false);
    const [isLooping, setIsLooping] = useState(false);
    const [audioURL, setAudioURL] = useState("");
    const [liked, setLiked] = useState(false);
    const [volume, setVolume] = useState(1);
    const [muted, setMuted] = useState(false);
    const next = useContext(NextContext);
    const { current, setCurrent } = useMusic();
    const eq = useEqualizer(audioRef);
    const songInfoRef = useRef(null);
    const listenedRef = useRef(0);
    const lastTimeRef = useRef(0);
    const [bgColor, setBgColor] = useState(null);

    const getSong = async () => {
        try {
            const get = await getSongsById(id);
            const data = await get.json();
            const song = data?.data?.[0];
            setData(song || []);
            const urls = song?.downloadUrl || [];
            // Try highest quality first
            setAudioURL(urls[4]?.url || urls[3]?.url || urls[2]?.url || urls[1]?.url || urls[0]?.url || "");
            if (song?.id) {
                setLiked(isLiked(song.id));
                songInfoRef.current = { id: song.id, name: song.name, artist: song.artists?.primary?.[0]?.name || "unknown" };
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
                    if (next?.nextData?.id) window.location.href = `/${next.nextData.id}`;
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
        const url = `https://${window.location.host}/${data.id}`;
        try {
            if (navigator.share) {
                await navigator.share({ title: data.name, url });
            } else if (navigator.clipboard) {
                await navigator.clipboard.writeText(url);
                toast.success('Link copied!');
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
        if (next?.nextData?.id) window.location.href = `/${next.nextData.id}`;
    };

    useEffect(() => {
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
            }
        };
    }, [id]);

    useEffect(() => {
        if (currentTime === duration && !isLooping && duration !== 0) {
            if (next?.nextData?.id) window.location.href = `/${next.nextData.id}`;
        }
    }, [currentTime, duration, isLooping, next?.nextData?.id]);

    return (
        <div
            className="mb-3 mt-10 pt-6 -mt-6 transition-colors duration-700"
            style={bgColor ? {
                background: `linear-gradient(to bottom, rgba(${bgColor.r},${bgColor.g},${bgColor.b},0.18), transparent 420px)`
            } : undefined}
        >
            <audio
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onLoadedData={() => setDuration(audioRef.current.duration)}
                autoPlay={playing}
                src={audioURL}
                ref={audioRef}
            />
            <div className="grid gap-6 w-full">
                <div className="sm:flex px-6 md:px-20 lg:px-32 grid gap-5 w-full">
                    <div>
                        {data.length <= 0 ? (
                            <Skeleton className="md:w-[130px] aspect-square rounded-2xl md:h-[150px]" />
                        ) : (
                            <div className="relative">
                                <img
                                    src={data?.image?.[2]?.url || ""}
                                    className="sm:h-[150px] h-full aspect-square bg-secondary/50 rounded-2xl sm:w-[200px] w-full sm:mx-0 mx-auto object-cover"
                                />
                                <img
                                    src={data?.image?.[2]?.url || ""}
                                    className="hidden dark:block absolute top-0 left-0 w-[110%] h-[110%] blur-3xl -z-10 opacity-50"
                                />
                            </div>
                        )}
                    </div>

                    {data.length <= 0 ? (
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
                                    <h1 className="text-xl font-bold md:max-w-lg">{data.name}</h1>
                                    <p className="text-sm text-muted-foreground">
                                        by{" "}
                                        <Link
                                            href={"/search/" + `${encodeURI((data?.artists?.primary?.[0]?.name || "unknown").toLowerCase().split(" ").join("+"))}`}
                                            className="text-foreground"
                                        >
                                            {data?.artists?.primary?.[0]?.name || "unknown"}
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
                                        <EqualizerButton eq={eq} />
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
                <div className="mt-10 -mb-3 px-6 md:px-20 lg:px-32">
                    <Next
                        name={next.nextData.name}
                        artist={next.nextData.artist}
                        image={next.nextData.image}
                        id={next.nextData.id}
                    />
                </div>
            )}
        </div>
    );
}
