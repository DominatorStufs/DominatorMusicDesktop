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
import { cn } from "@/lib/utils";
import { useEqualizer } from "@/hooks/use-equalizer";
import EqualizerButton from "@/components/equalizer-button";

export default function Player() {
    const [data, setData] = useState([]);
    const [playing, setPlaying] = useState(false);
    const audioRef = useRef(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [audioURL, setAudioURL] = useState("");
    const [isLooping, setIsLooping] = useState(false);
    const [liked, setLiked] = useState(false);
    const values = useContext(MusicContext);
    const eq = useEqualizer(audioRef);
    const songInfoRef = useRef(null);
    const listenedRef = useRef(0);
    const lastTimeRef = useRef(0);

    const getSong = async () => {
        try {
            const get = await getSongsById(values.music);
            const data = await get.json();
            const song = data?.data?.[0];
            setData(song || []);
            const urls = song?.downloadUrl || [];
            setAudioURL(urls[2]?.url || urls[1]?.url || urls[0]?.url || "");
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
                }
            };
        }
    }, [values.music]);
    return (
        <main>
            <audio autoPlay={playing} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onLoadedData={() => setDuration(audioRef.current.duration)} src={audioURL} ref={audioRef}></audio>
            {values.music && <div className="player-bar glass-surface shadow-lg fixed grid bottom-0 max-w-[500px] md:border-l md:border-r md:rounded-md md:!rounded-b-none md:ml-auto right-0 left-0 border-border overflow-hidden border-t-none z-50 bg-background gap-3 transition-all duration-300">
                <div className="w-full">
                    {!duration ? <Skeleton className="h-1 w-full" /> : (
                        <Slider thumbClassName="hidden" trackClassName="h-1 transition-[height] group-hover:h-2 rounded-none" onValueChange={handleSeek} value={[currentTime]} max={duration} className="w-full group" />
                    )}
                </div>
                <div className="grid gap-2 p-3 pt-0">
                    <div className="flex items-center justify-between gap-3">
                        <div className="relative flex items-center gap-2 w-full">
                            <img src={data?.image?.[1]?.url || ""} alt={data?.name} className="rounded-md aspect-square h-12 w-12 bg-secondary hover:opacity-85 transition cursor-pointer" />
                            <img src={data?.image?.[1]?.url || ""} alt={data?.name} className="rounded-md h-[110%] min-w-[110%] opacity-40 hidden dark:block absolute top-0 left-0 right-0 blur-3xl -z-10" />
                            <div>
                                {!data?.name ? <Skeleton className="h-4 w-32" /> : (
                                    <>
                                        <Link href={`/${values.music}`} className="text-base hover:opacity-85 transition font-medium flex md:hidden gap-2 items-center">{data?.name?.slice(0, 10)}{data?.name?.length >= 11 ? ".." : ""}<ExternalLink className="h-3.5 w-3.5 text-muted-foreground" /></Link>
                                        <Link href={`/${values.music}`} className="text-base hover:opacity-85 transition font-medium gap-2 items-center hidden md:flex">{data?.name}<ExternalLink className="h-3.5 w-3.5 text-muted-foreground" /></Link>
                                    </>
                                )}
                                {!data?.artists?.primary?.[0]?.name ? <Skeleton className="h-3 w-14 mt-1" /> : (
                                    <>
                                        <h2 className="block md:hidden text-xs -mt-0.5 text-muted-foreground">{data.artists.primary[0].name.slice(0, 20)}{data.artists.primary[0].name.length > 20 ? ".." : ""}</h2>
                                        <h2 className="hidden md:block text-xs -mt-0.5 text-muted-foreground">{data.artists.primary[0].name}</h2>
                                    </>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <EqualizerButton eq={eq} />
                            <Button size="icon" className="p-0 h-9 w-9" variant={!liked ? "ghost" : "secondary"} onClick={handleLike}>
                                <Heart className={cn("h-3.5 w-3.5 transition", liked && "fill-red-500 text-red-500")} />
                            </Button>
                            <Button size="icon" className="p-0 h-9 w-9" variant={!isLooping ? "ghost" : "secondary"} onClick={loopSong}>
                                {!isLooping ? <Repeat className="h-3.5 w-3.5" /> : <Repeat1 className="h-3.5 w-3.5" />}
                            </Button>
                            <Button size="icon" className="p-0 h-9 w-9" onClick={togglePlayPause}>{playing ? <IoPause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</Button>
                            <Button size="icon" className="p-0 h-9 w-9" variant="secondary" onClick={() => { values.setMusic(null); setCurrent(0); localStorage.removeItem("last-played"); localStorage.removeItem("p"); audioRef.current.currentTime = 0; audioRef.current.src = null; setAudioURL(null); }}>
                                <X className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>}
        </main >
    )
}
