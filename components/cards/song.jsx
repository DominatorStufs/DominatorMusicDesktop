"use client";
import Link from "next/link";
import { Skeleton } from "../ui/skeleton";
import { useContext, useState, useEffect } from "react";
import { MusicContext } from "@/hooks/use-context";
import { IoPlay } from "react-icons/io5";
import { Heart } from "lucide-react";
import { isLiked, toggleLiked, addToHistory } from "@/lib/library";
import { cn } from "@/lib/utils";

export default function SongCard({ title, image, artist, id, desc }) {
    const ids = useContext(MusicContext);
    const [liked, setLiked] = useState(false);

    useEffect(() => {
        if (id) setLiked(isLiked(id));
    }, [id]);

    const setLastPlayed = () => {
        localStorage.removeItem("p");
        localStorage.setItem("last-played", id);
        addToHistory({ id, name: title, artist, image });
    };

    const handleLike = (e) => {
        e.stopPropagation();
        e.preventDefault();
        const nowLiked = toggleLiked({ id, name: title, artist, image });
        setLiked(nowLiked);
    };

    return (
        <div className="h-fit w-[200px]">
            <div className="overflow-hidden rounded-md">
                {image ? (
                    <div className="relative" onClick={() => { ids.setMusic(id); setLastPlayed(); }}>
                        <img src={image} alt={title} className="h-[182px] blurz w-full bg-secondary/60 rounded-md transition hover:scale-105 cursor-context-menu" />
                        <div className="cursor-pointer absolute z-10 bottom-2 left-2 bg-background/60 backdrop-blur-md rounded-full h-8 w-8 flex items-center justify-center"><IoPlay className="w-4 h-4 -mr-0.5 dark:fill-white" /></div>
                        <button
                            onClick={handleLike}
                            aria-label="Like song"
                            className="absolute z-10 bottom-2 right-2 bg-background/60 backdrop-blur-md rounded-full h-8 w-8 flex items-center justify-center transition hover:scale-110"
                        >
                            <Heart className={cn("h-4 w-4 transition", liked && "fill-red-500 text-red-500")} />
                        </button>
                    </div>
                ) : (
                    <Skeleton className="w-full h-[182px]" />
                )}
            </div>
            <div className="cursor-pointer">
                {title ? (
                    <div onClick={() => { ids.setMusic(id); setLastPlayed(); }} className="mt-3 flex items-center justify-between">
                        <h1 className="text-base">{title.slice(0, 20)}{title.length > 20 && '...'}</h1>
                    </div>
                ) : (
                    <Skeleton className="w-[70%] h-4 mt-2" />
                )}
                {desc && (
                    <p className="text-xs text-muted-foreground">{desc.slice(0, 30)}</p>
                )}
                {artist ? (
                    <p className="text-sm font-light text-muted-foreground">{artist.slice(0, 20)}{artist.length > 20 && '...'}</p>
                ) : (
                    <Skeleton className="w-10 h-2 mt-2" />
                )}
            </div>
        </div>
    )
}
