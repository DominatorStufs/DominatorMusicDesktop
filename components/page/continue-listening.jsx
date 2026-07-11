"use client"
import { useContext, useEffect, useState } from "react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { getHistory } from "@/lib/library";
import { MusicContext } from "@/hooks/use-context";
import { IoPlay } from "react-icons/io5";

export default function ContinueListening() {
    const [history, setHistory] = useState([]);
    const ids = useContext(MusicContext);

    useEffect(() => {
        setHistory(getHistory());
    }, []);

    const play = (song) => {
        ids.setMusic(song.id);
        localStorage.removeItem("p");
        localStorage.setItem("last-played", song.id);
    };

    if (!history.length) return null;

    return (
        <div className="mt-14">
            <h1 className="text-base">Continue Listening</h1>
            <p className="text-xs text-muted-foreground">Pick up right where you left off.</p>
            <ScrollArea className="rounded-md mt-4">
                <div className="flex gap-4">
                    {history.slice(0, 10).map((song) => (
                        <div key={song.id} onClick={() => play(song)} className="w-[200px] cursor-pointer">
                            <div className="relative overflow-hidden rounded-md">
                                <img src={song.image || ""} alt={song.name} className="h-[182px] w-full bg-secondary/60 rounded-md transition hover:scale-105 object-cover" />
                                <div className="absolute z-10 bottom-2 left-2 bg-background/60 backdrop-blur-md rounded-full h-8 w-8 flex items-center justify-center">
                                    <IoPlay className="w-4 h-4 -mr-0.5 dark:fill-white" />
                                </div>
                            </div>
                            <h1 className="text-base mt-3">{song.name?.slice(0, 20)}{song.name?.length > 20 && '...'}</h1>
                            <p className="text-sm font-light text-muted-foreground">{song.artist?.slice(0, 20)}</p>
                        </div>
                    ))}
                </div>
                <ScrollBar orientation="horizontal" className="hidden sm:flex" />
            </ScrollArea>
        </div>
    );
}
