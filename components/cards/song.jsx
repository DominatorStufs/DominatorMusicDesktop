"use client";
import Link from "next/link";
import { Skeleton } from "../ui/skeleton";
import { useContext, useState, useEffect } from "react";
import { MusicContext } from "@/hooks/use-context";
import { IoPlay } from "react-icons/io5";
import { Heart } from "lucide-react";
import { isLiked, toggleLiked, addToHistory } from "@/lib/library";
import { cn } from "@/lib/utils";
import SourceBadge from "@/components/source-badge";
import { sourceOf } from "@/lib/unified-song";

// The source badge is derived from the id ("spotify:xyz" -> Spotify), so every
// caller gets it automatically instead of having to pass a prop. Passing
// `source` explicitly still overrides that.
export default function SongCard({ title, image, artist, id, desc, source }) {
    const badgeSource = source || (id ? sourceOf(id) : null);
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
        <div className="group h-fit w-[150px] sm:w-[180px] lg:w-[200px] flex-shrink-0">
            <div className="overflow-hidden rounded-xl">
                {image ? (
                    <div
                        className="relative aspect-square cursor-pointer"
                        onClick={() => { ids.setMusic(id); setLastPlayed(); }}
                    >
                        <img
                            src={image}
                            alt={title}
                            loading="lazy"
                            className="h-full w-full object-cover bg-secondary/60 rounded-xl transition duration-300 group-hover:scale-[1.04]"
                        />
                        {/* Scrim keeps the controls readable over bright artwork */}
                        <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-black/55 via-transparent to-transparent opacity-0 transition duration-300 group-hover:opacity-100" />
                        <div className="absolute z-10 bottom-2 left-2 bg-primary text-primary-foreground shadow-lg rounded-full h-9 w-9 flex items-center justify-center transition duration-300 opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0">
                            <IoPlay className="w-4 h-4 -mr-0.5" />
                        </div>
                        <button
                            onClick={handleLike}
                            aria-label={liked ? "Unlike song" : "Like song"}
                            className={cn(
                                "absolute z-10 bottom-2 right-2 bg-background/70 backdrop-blur-md rounded-full h-9 w-9 flex items-center justify-center transition duration-300 hover:scale-110",
                                // A liked song stays visible; the rest appear on hover.
                                liked ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                            )}
                        >
                            <Heart className={cn("h-4 w-4 transition", liked && "fill-red-500 text-red-500")} />
                        </button>
                    </div>
                ) : (
                    <Skeleton className="w-full aspect-square rounded-xl" />
                )}
            </div>
            <div className="cursor-pointer">
                {title ? (
                    <div onClick={() => { ids.setMusic(id); setLastPlayed(); }} className="mt-3">
                        <h3 className="text-sm font-medium leading-snug truncate" title={title}>{title}</h3>
                        {badgeSource && badgeSource !== "saavn" && (
                            <div className="mt-1"><SourceBadge source={badgeSource} /></div>
                        )}
                    </div>
                ) : (
                    <Skeleton className="w-[70%] h-4 mt-2" />
                )}
                {desc && (
                    <p className="text-xs text-muted-foreground">{desc.slice(0, 30)}</p>
                )}
                {artist ? (
                    <p className="text-xs text-muted-foreground truncate mt-0.5" title={artist}>{artist}</p>
                ) : (
                    <Skeleton className="w-10 h-2 mt-2" />
                )}
            </div>
        </div>
    )
}
