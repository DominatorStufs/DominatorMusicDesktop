"use client"
import { useContext, useEffect, useState } from "react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { getHistory } from "@/lib/library";
import { MusicContext } from "@/hooks/use-context";
import { IoPlay } from "react-icons/io5";
import SourceBadge from "@/components/source-badge";
import { sourceOf } from "@/lib/unified-song";
import { decodeEntities } from "@/lib/text";
import SectionHeader from "@/components/page/section-header";

export default function ContinueListening() {
    const [history, setHistory] = useState([]);
    const ids = useContext(MusicContext);

    useEffect(() => {
        // BUG FIX: entries without an id produced duplicate React keys and a
        // dead click target, so they are filtered out here.
        setHistory((getHistory() || []).filter((s) => s && s.id));
    }, []);

    const play = (song) => {
        ids.setMusic(song.id);
        localStorage.removeItem("p");
        localStorage.setItem("last-played", song.id);
    };

    if (!history.length) return null;

    return (
        <div className="mt-12">
            <SectionHeader title="Continue Listening" subtitle="Pick up where you left off." />
            <ScrollArea className="rounded-md">
                <div className="flex gap-4">
                    {history.slice(0, 10).map((song) => (
                        <div key={song.id} onClick={() => play(song)} className="group w-[150px] sm:w-[180px] lg:w-[200px] flex-shrink-0 cursor-pointer">
                            <div className="relative overflow-hidden rounded-xl aspect-square">
                                <img src={song.image || ""} alt={song.name} loading="lazy" className="h-full w-full bg-secondary/60 rounded-xl transition duration-300 group-hover:scale-[1.04] object-cover" />
                                <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-black/55 via-transparent to-transparent opacity-0 transition duration-300 group-hover:opacity-100" />
                                <div className="absolute z-10 bottom-2 left-2 bg-primary text-primary-foreground shadow-lg rounded-full h-9 w-9 flex items-center justify-center transition duration-300 opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0">
                                    <IoPlay className="w-4 h-4 -mr-0.5" />
                                </div>
                            </div>
                            <h3 className="text-sm font-medium mt-3 truncate" title={decodeEntities(song.name)}>{decodeEntities(song.name)}</h3>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">{decodeEntities(song.artist)}</p>
                            {sourceOf(song.id) !== "saavn" && (
                                <div className="mt-1"><SourceBadge source={sourceOf(song.id)} /></div>
                            )}
                        </div>
                    ))}
                </div>
                <ScrollBar orientation="horizontal" className="hidden sm:flex" />
            </ScrollArea>
        </div>
    );
}
